
import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = 'https://rizenojzaklraiqkglxpk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpemVub2p6YWtscmFpcWxneHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NzUyNzcsImV4cCI6MjA2ODQ1MTI3N30.sxmHSPCibp0W16xT0riMAhAAceXPxIwuDBFtfGeN4ms'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Database helper functions
export const auth = {
  async signUp(email, password, userData) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    })
    return { data, error }
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Course and content functions
export const courses = {
  async getCourses() {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
    return { data, error }
  },

  async getCourseTopics(courseId) {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('course_id', courseId)
    return { data, error }
  },

  async getCourseMaterials(courseId) {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('course_id', courseId)
    return { data, error }
  }
}

// Test functions
export const tests = {
  async getTests(courseId = null) {
    let query = supabase.from('tests').select('*')
    if (courseId) {
      query = query.eq('course_id', courseId)
    }
    const { data, error } = await query
    return { data, error }
  },

  async getTestQuestions(testId) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', testId)
    return { data, error }
  },

  async createTest(testData) {
    const { data, error } = await supabase
      .from('tests')
      .insert(testData)
      .select()
    return { data, error }
  },

  async submitTestResult(resultData) {
    const { data, error } = await supabase
      .from('test_results')
      .insert(resultData)
    return { data, error }
  },

  async getTestResults(userId) {
    const { data, error } = await supabase
      .from('test_results')
      .select(`
        *,
        tests (
          name,
          course_id
        )
      `)
      .eq('user_id', userId)
    return { data, error }
  }
}

// File storage functions
export const storage = {
  async uploadFile(bucket, filePath, file) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file)
    return { data, error }
  },

  async getFileUrl(bucket, filePath) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)
    return data.publicUrl
  },

  async downloadFile(bucket, filePath) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath)
    return { data, error }
  }
}

// User profile functions
export const profiles = {
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
    return { data, error }
  }
}
