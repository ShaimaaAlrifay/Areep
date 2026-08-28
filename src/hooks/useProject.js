import { useEffect, useState } from 'react'
import { getProject } from '../services/projectsService'

/**
 * Loads a single project, scoped to the signed-in org, exposing the same
 * loading/notFound shape ChatPage.jsx's ExistingProjectChat originally
 * inlined — factored out here so RequirementsReview.jsx (spec sections
 * 25-26) can load the same project (for `name`/`status`/`confidence`/
 * `discovery_state`) without duplicating the fetch-and-guard logic.
 */
export function useProject(projectId, organizationId) {
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!organizationId) return undefined
    let mounted = true
    setLoading(true)
    setNotFound(false)

    getProject(projectId, organizationId).then(({ data, error }) => {
      if (!mounted) return
      if (error || !data) {
        setNotFound(true)
      } else {
        setProject(data)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
    }
  }, [projectId, organizationId])

  return { project, loading, notFound }
}
