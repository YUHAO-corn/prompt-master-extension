import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { usePromptsData } from '../../../hooks/usePromptsData';
import { Prompt } from '../../../services/prompt/types';
import { PromptErrorCode } from '../../../services/prompt/errors';
import { useMembership } from '../../../hooks/useMembership';
import { useQuota } from '../../../hooks/useQuota';
import { safeLogger } from '../../../utils/safeEnvironment';

interface PromptFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt?: Prompt;
  currentPromptCount?: number;
}

export function PromptFormModal({ 
  isOpen, 
  onClose, 
  prompt, 
  currentPromptCount = 0
}: PromptFormModalProps) {
  const { addPrompt, updatePrompt } = usePromptsData();
  const { isProMember } = useMembership();
  const { quotaInfo, loading: quotaLoading, error: quotaError } = useQuota();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isFavorite, setIsFavorite] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title);
      setContent(prompt.content);
      setIsFavorite(true);
    } else {
      setTitle('');
      setContent('');
      setIsFavorite(true);
    }
    setError(null);
  }, [prompt, isOpen]);
  
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const titleInput = document.getElementById('prompt-title');
        if (titleInput) titleInput.focus();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, title, content]);
  
  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }
    
    if (!content.trim()) {
      setError('Content cannot be empty');
      return;
    }
    
    setError(null);
    setIsSubmitting(true);

    try {
      if (prompt) {
        await updatePrompt(prompt.id, {
          title,
          content,
          isFavorite: true,
          updatedAt: Date.now()
        });
        onClose();
      } else {
        const savedPrompt = await addPrompt({
          title,
          content,
          isFavorite: true,
          tags: [],
          source: 'user'
        });

        if (savedPrompt) {
            onClose();
        } else {
            if (!error) {
                 setError('Failed to save prompt. Please try again.');
            }
        }
      }
      
    } catch (err: any) {
      safeLogger.error('Failed to save prompt in PromptFormModal:', err);
      if (err.code === PromptErrorCode.STORAGE_LIMIT_EXCEEDED) {
        const limit = quotaInfo?.limits?.maxPrompts;
        if (limit) {
            setError(`Storage limit of ${limit} prompts reached. Upgrade to Pro or manage existing prompts to free up space.`);
        } else {
            setError(err.message || 'Storage limit reached. Please upgrade or manage prompts.');
        }
      } else {
        setError(err.message || 'An unexpected error occurred while saving the prompt.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={prompt ? 'Edit Prompt' : 'Add Prompt'}
      className="max-w-lg"
    >
      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-md p-3 text-red-600 dark:text-red-200 text-sm">
            {error}
          </div>
        )}
        
        <div>
          <label htmlFor="prompt-title" className="block text-sm font-medium text-gray-700 dark:text-magic-300 mb-1">
            Title
          </label>
          <Input
            id="prompt-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter prompt title..."
            className="w-full"
          />
        </div>
        
        <div>
          <label htmlFor="prompt-content" className="block text-sm font-medium text-gray-700 dark:text-magic-300 mb-1">
            Content
          </label>
          <textarea
            id="prompt-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter prompt content..."
            rows={6}
            className="w-full p-3 bg-white dark:bg-magic-800/50 border border-gray-300 dark:border-magic-600/30 rounded-md text-gray-700 dark:text-magic-200 placeholder-gray-400 dark:placeholder-magic-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-magic-600 focus:border-transparent transition-all resize-none scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-magic-600 scrollbar-track-gray-100 dark:scrollbar-track-magic-800"
          />
        </div>
        
        <div className="flex justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-magic-700 hover:bg-gray-300 dark:hover:bg-magic-600 rounded-md text-gray-700 dark:text-magic-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || quotaLoading}
            className="px-4 py-2 bg-purple-600 dark:bg-magic-600 hover:bg-purple-500 dark:hover:bg-magic-500 rounded-md text-white transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
} 