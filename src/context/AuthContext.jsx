import React, { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '../services/apiService'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Limpiar sesión al iniciar la aplicación (no mantener sesión activa)
  useEffect(() => {
    // Limpiar cualquier sesión previa al iniciar
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    setUser(null)
    setLoading(false)
  }, [])

  const login = async (correo, contrasena) => {
    try {
      const response = await authService.login(correo, contrasena)
      
      // La respuesta debe contener el usuario
      if (response.usuario) {
        const usuario = response.usuario
        
        // Verificar que el usuario tenga un rol permitido
        const tipoRol = (usuario.tipoRol || usuario.TipoRol || '').toLowerCase().trim()
        const rolPermitido = tipoRol === 'administrador' || tipoRol === 'auxiliar'
        
        if (!rolPermitido) {
          // Limpiar cualquier dato guardado
          localStorage.removeItem('authToken')
          throw new Error('No tienes permisos para acceder a esta aplicación. Solo usuarios Administrador y Auxiliar pueden ingresar.')
        }
        
        // Guardar usuario en localStorage
        localStorage.setItem('user', JSON.stringify(usuario))
        setUser(usuario)
        
        return { success: true, usuario }
      } else {
        throw new Error('No se recibió información del usuario en la respuesta')
      }
    } catch (error) {
      console.error('Error en login:', error)
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    setUser(null)
  }

  const isAuthenticated = () => {
    return user !== null
  }

  const hasRole = (roles) => {
    if (!user) return false
    const userRole = (user.tipoRol || user.TipoRol || '').toLowerCase()
    return roles.some(role => role.toLowerCase() === userRole)
  }

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated,
    hasRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

