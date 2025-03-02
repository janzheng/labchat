import React, { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { projectsStore, selectedProjectId, assignComponentToProject, type ComponentType, isLoading, error, isInitialized } from '@/lib/stores';
import Canvas from './canvas/Canvas';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useBasic } from '@basictech/react'

export const ProjectWorkspace: React.FC = () => {
  const store = useStore(projectsStore);
  const currentProjectId = useStore(selectedProjectId);
  const loading = useStore(isLoading);
  const storeError = useStore(error);
  const initialized = useStore(isInitialized);
  const { isSignedIn, signin, user, db } = useBasic()
  
  // Sync URL with selected project
  useEffect(() => {
    const projectId = window.location.pathname.match(/\/project\/([^/]+)/)?.[1];
    if (projectId && projectId !== currentProjectId) {
      selectedProjectId.set(projectId);
    }
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const projectId = window.location.pathname.match(/\/project\/([^/]+)/)?.[1];
      if (projectId) {
        selectedProjectId.set(projectId);
      } else {
        selectedProjectId.set(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  const selectedProject = currentProjectId ? store.items[currentProjectId] : null;

  const handleAssignType = async (type: ComponentType) => {
    if (currentProjectId) {
      await assignComponentToProject(currentProjectId, type);
    }
  };

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg">Initializing workspace...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (storeError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg text-red-500">Error: {storeError}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Main content area */}
      <div className="flex-1 overflow-auto">
        <SidebarTrigger className="m-2 ml-4 p-2 relative top-[2px]" />
        <Canvas 
          project={selectedProject?.type === 'project' ? selectedProject : undefined}
          onAssignType={handleAssignType}
        />
      </div>
    </div>
  );
};

export default ProjectWorkspace; 