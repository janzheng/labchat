import React, { useState, useEffect } from 'react';
import { BaseComponent, type BaseComponentProps } from '@/components/canvas/BaseComponent';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actions } from 'astro:actions';
import type { ChatData } from '@/lib/stores';
import projectsStore from '@/lib/stores';
import ReactMarkdown from 'react-markdown';
import { useBasic, useQuery } from '@basictech/react';
import type { ComponentConfig } from '@/lib/stores';

export const Chat: React.FC<BaseComponentProps> = ({ config }) => {
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const { db, isSignedIn } = useBasic();
  
  // Get remote project data
  let remoteProject = useQuery(() => 
    db?.collection('projects')
      .getAll()
      .then(projects => projects.find(p => p.localId === config.projectId))
  );

  // First sync local to remote on initial load
  useEffect(() => {
    if (!db || !isSignedIn || remoteProject === undefined) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') return;

    // Only sync to remote if there's no remote project yet
    if (!remoteProject) {
      syncToRemote(project.components[config.componentIndex].data);
    }
  }, [remoteProject, db, isSignedIn]);

  // Keep local in sync with remote changes
  useEffect(() => {
    if (!remoteProject || !isSignedIn) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') return;

    const remoteData = remoteProject.data?.components?.[config.componentIndex]?.data;
    const localData = project.components[config.componentIndex].data;
    
    if (JSON.stringify(remoteData) !== JSON.stringify(localData)) {
      console.log('Syncing local chat to match remote:', remoteData);
      // Update local store with remote data
      updateProjectStore(remoteData, false);
    }
  }, [remoteProject]);

  const syncToRemote = async (updatedData: ChatData) => {
    if (!db || !isSignedIn) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') return;

    const projectData = {
      id: project.id,
      name: project.name,
      parentId: project.parentId,
      type: project.type,
      components: project.components.map((comp, index) => 
        index === config.componentIndex 
          ? { ...comp, data: updatedData }
          : comp
      )
    };

    if (remoteProject) {
      await db.collection('projects').update(remoteProject.id, {
        localId: config.projectId,
        data: projectData,
        lastModified: Date.now()
      });
    } else {
      await db.collection('projects').add({
        localId: config.projectId,
        data: projectData,
        lastModified: Date.now()
      });
    }
  };

  // Get the stored responses from config.data
  const chatData = (config.data || {}) as ChatData;
  const messages = chatData.messages || [];

  const updateProjectStore = async (newData: ChatData, shouldSyncRemote = true) => {
    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') {
      console.error('Project not found or invalid type');
      return;
    }

    const updatedComponents = [...project.components];
    updatedComponents[config.componentIndex] = {
      ...updatedComponents[config.componentIndex],
      data: newData
    };

    projectsStore.set({
      ...currentState,
      items: {
        ...currentState.items,
        [config.projectId]: {
          ...project,
          components: updatedComponents
        }
      }
    });

    // Only sync to remote if flag is true
    if (shouldSyncRemote) {
      await syncToRemote(newData);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    try {
      setLoading(true);

      const messageHistory = messages.length === 0
        ? [{ role: "user", content: input.trim() }]
        : [
          ...messages.map(msg => ({
            role: "user",
            content: msg.prompt || ""
          })),
          ...messages.map(msg => ({
            role: "assistant",
            content: msg.response || ""
          })),
          { role: "user", content: input.trim() }
        ];

      const { data, error } = await actions.canvas.chat({
        model: 'llama-3.1-8b-instant',
        provider: 'groq',
        projectId: config.projectId,
        componentIndex: config.componentIndex,
        messages: messageHistory
      });

      if (error) {
        console.error('Error calling Chat action:', error);
        return;
      }

      // Update the store with the new message
      const updatedChatData: ChatData = {
        messages: [...messages, data]
      };
      
      await updateProjectStore(updatedChatData);
      setInput('');
    } catch (error) {
      console.error('Error calling Chat action:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Chat Component</h2>

      <div className="space-y-4">
        {messages.length > 0 && (
          <div className="mt-4 space-y-2">
            {messages.map(message => (
              <div key={message.id} className="p-3 bg-white rounded-md">
                <p className="text-sm font-medium">Message: {message.prompt}</p>
                <div className="text-sm mt-2 prose prose-sm max-w-none">
                  <ReactMarkdown>
                    {message.response}
                  </ReactMarkdown>
                </div>
                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>{message.settings.model} ({message.settings.provider})</span>
                  <span>{new Date(message.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat; 