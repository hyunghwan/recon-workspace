import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore'
import type { Transaction } from './data'
import { firestore } from './firebase'

function requireFirestore(): Firestore {
  if (!firestore) throw new Error('Firebase is not configured.')
  return firestore
}

export async function saveWorkspaceTransactions(userId: string, transactions: Transaction[]) {
  const db = requireFirestore()

  const workspaceRef = doc(db, 'users', userId, 'workspaces', 'default')
  await setDoc(
    workspaceRef,
    {
      name: 'Default Workspace',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  const writes = transactions.map((txn) => {
    const txnRef = doc(db, 'users', userId, 'workspaces', 'default', 'transactions', txn.id)
    return setDoc(
      txnRef,
      {
        ...txn,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  })

  await Promise.all(writes)
}

export async function loadWorkspaceTransactions(userId: string): Promise<Transaction[]> {
  const db = requireFirestore()
  const txnsRef = collection(db, 'users', userId, 'workspaces', 'default', 'transactions')
  const snapshot = await getDocs(txnsRef)
  return snapshot.docs.map((docSnap) => docSnap.data() as Transaction)
}
