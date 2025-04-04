import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type DocumentData,
  type QuerySnapshot,
  type DocumentReference,
} from "firebase/firestore"

// Types
export interface Project {
  id?: string
  title: string
  productType: string
  status: "draft" | "preview" | "ordered"
  thumbnailPath?: string
  createdAt?: any
  updatedAt?: any
  userId: string
  pages?: any[]
  orderNumber?: string
  orderDate?: any
  estimatedDelivery?: any
}

// Get a reference to a user's projects collection
export const getUserProjectsRef = (userId: string) => {
  const db = getFirestore()
  return collection(db, "users", userId, "projects")
}

// Create a new project
export const createProject = async (userId: string, projectData: Omit<Project, "id" | "userId" | "createdAt" | "updatedAt">): Promise<string> => {
  const projectsRef = getUserProjectsRef(userId)
  
  const newProject = {
    ...projectData,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deleted: false
  }
  
  const docRef = await addDoc(projectsRef, newProject)
  return docRef.id
}

// Get a project by ID
export const getProject = async (userId: string, projectId: string): Promise<Project | null> => {
  const db = getFirestore()
  const projectRef = doc(db, "users", userId, "projects", projectId)
  
  const projectSnap = await getDoc(projectRef)
  
  if (!projectSnap.exists()) {
    return null
  }
  
  return {
    id: projectSnap.id,
    ...projectSnap.data(),
  } as Project
}

// Update a project
export const updateProject = async (userId: string, projectId: string, projectData: Partial<Project>): Promise<void> => {
  const db = getFirestore()
  const projectRef = doc(db, "users", userId, "projects", projectId)
  
  await updateDoc(projectRef, {
    ...projectData,
    updatedAt: serverTimestamp(),
  })
}

// Delete a project
export const deleteProject = async (userId: string, projectId: string): Promise<void> => {
  const db = getFirestore()
  const projectRef = doc(db, "users", userId, "projects", projectId)
  
  await deleteDoc(projectRef)
}

// Get projects by status
export const getProjectsByStatus = async (userId: string, status: Project["status"]): Promise<Project[]> => {
  const projectsRef = getUserProjectsRef(userId)
  
  const q = query(
    projectsRef,
    where("status", "==", status),
    where("deleted", "==", false),
    orderBy("updatedAt", "desc")
  )
  
  const projectsSnap = await getDocs(q)
  
  return projectsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Project[]
}

// Get all projects for a user
export const getAllProjects = async (userId: string): Promise<Project[]> => {
  const projectsRef = getUserProjectsRef(userId)
  
  const q = query(
    projectsRef,
    where("deleted", "==", false),
    orderBy("updatedAt", "desc")
  )
  
  const projectsSnap = await getDocs(q)
  
  return projectsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Project[]
} 