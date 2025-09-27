'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search, BookOpen, Users, Calendar, Eye, Trash2, PlusCircle, X } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface QuestionBank {
  id: number;
  name: string;
  description: string;
  department_name: string;
  subject_name?: string;
  created_by_name: string;
  questions_count: number;
  is_public: boolean;
  created_at: string;
  updated_at?: string;
  questions?: QuestionBankItem[];
}

interface QuestionBankItem {
  id: number;
  question_text: string;
  question_marks: number;
  bloom_level: string;
  difficulty_level: string;
  added_by_name: string;
  added_at: string;
}

interface QuestionBankManagerProps {
  departmentId?: number;
  subjectId?: number;
  showPublicOnly?: boolean;
}

export default function QuestionBankManager({
  departmentId,
  subjectId,
  showPublicOnly = false
}: QuestionBankManagerProps) {
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [bankQuestions, setBankQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPublic, setFilterPublic] = useState<boolean | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);

  useEffect(() => {
    fetchQuestionBanks();
  }, [departmentId, subjectId, showPublicOnly]);

  const fetchQuestionBanks = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (departmentId) params.department_id = departmentId;
      if (subjectId) params.subject_id = subjectId;
      if (showPublicOnly) params.is_public = true;
      if (filterPublic !== null) params.is_public = filterPublic;

      const data = await apiClient.getQuestionBanks(params);
      setQuestionBanks(data.data || []);
    } catch (error) {
      console.error('Failed to fetch question banks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBankQuestions = async (bankId: number) => {
    try {
      const data = await apiClient.getQuestionBankQuestions(bankId);
      setBankQuestions(data.data || []);
    } catch (error) {
      console.error('Failed to fetch bank questions:', error);
    }
  };

  const createQuestionBank = async (bankData: Partial<QuestionBank>) => {
    try {
      const newBank = await apiClient.createQuestionBank(bankData);
      setQuestionBanks(prev => [newBank.data, ...prev]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create question bank:', error);
    }
  };

  const deleteQuestionBank = async (bankId: number) => {
    if (!confirm('Are you sure you want to delete this question bank?')) return;

    try {
      await apiClient.deleteQuestionBank(bankId);
      setQuestionBanks(prev => prev.filter(bank => bank.id !== bankId));
    } catch (error) {
      console.error('Failed to delete question bank:', error);
    }
  };

  const handleRemoveQuestion = async (bankId: number, questionId: number) => {
    if (!confirm('Are you sure you want to remove this question from the bank?')) return;

    try {
      await apiClient.removeQuestionFromBank(bankId, questionId);
      setQuestionBanks(prev => 
        prev.map(bank => 
          bank.id === bankId 
            ? { ...bank, questions: bank.questions?.filter((q: QuestionBankItem) => q.id !== questionId) || [] }
            : bank
        )
      );
      toast.success('Question removed successfully');
    } catch (error) {
      console.error('Failed to remove question:', error);
      toast.error('Failed to remove question');
    }
  };

  const addQuestionToBank = async (bankId: number, questionId: number) => {
    try {
      await apiClient.addQuestionToBank(bankId, questionId);
      fetchBankQuestions(bankId);
      fetchQuestionBanks(); // Refresh to update question count
    } catch (error) {
      console.error('Failed to add question to bank:', error);
    }
  };

  const removeQuestionFromBank = async (bankId: number, questionId: number) => {
    try {
      await apiClient.removeQuestionFromBank(bankId, questionId);
      fetchBankQuestions(bankId);
      fetchQuestionBanks(); // Refresh to update question count
    } catch (error) {
      console.error('Failed to remove question from bank:', error);
    }
  };

  const filteredBanks = questionBanks.filter(bank => {
    const matchesSearch = bank.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bank.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Question Banks</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>Create Bank</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search question banks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterPublic === null ? '' : filterPublic.toString()}
          onChange={(e) => setFilterPublic(e.target.value === '' ? null : e.target.value === 'true')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Banks</option>
          <option value="true">Public Only</option>
          <option value="false">Private Only</option>
        </select>
      </div>

      {/* Question Banks Grid */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBanks.map((bank) => (
            <div
              key={bank.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-900">{bank.name}</h3>
                  {bank.is_public && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      Public
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => {
                      setSelectedBank(bank);
                      fetchBankQuestions(bank.id);
                      setShowQuestionsModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="View Questions"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteQuestionBank(bank.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete Bank"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {bank.description && (
                <p className="text-gray-600 text-sm mb-4">{bank.description}</p>
              )}

              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>{bank.department_name}</span>
                </div>
                {bank.subject_name && (
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4" />
                    <span>{bank.subject_name}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>Created {formatDate(bank.created_at)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <PlusCircle className="w-4 h-4" />
                  <span>{bank.questions_count} questions</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Created by {bank.created_by_name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Question Bank Modal */}
      {showCreateModal && (
        <CreateQuestionBankModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createQuestionBank}
          departmentId={departmentId}
          subjectId={subjectId}
        />
      )}

      {/* View Questions Modal */}
      {showQuestionsModal && selectedBank && (
        <ViewQuestionsModal
          bank={selectedBank}
          questions={bankQuestions}
          onClose={() => {
            setShowQuestionsModal(false);
            setSelectedBank(null);
          }}
          onRemoveQuestion={handleRemoveQuestion}
          onAddQuestion={addQuestionToBank}
        />
      )}
    </div>
  );
}

// Create Question Bank Modal Component
function CreateQuestionBankModal({
  onClose,
  onCreate,
  departmentId,
  subjectId
}: {
  onClose: () => void;
  onCreate: (data: Partial<QuestionBank>) => void;
  departmentId?: number;
  subjectId?: number;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_public: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      ...formData,
      // department_id: departmentId,
      // subject_id: subjectId
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Create Question Bank</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_public"
              checked={formData.is_public}
              onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
              className="mr-2"
            />
            <label htmlFor="is_public" className="text-sm text-gray-700">
              Make this bank public
            </label>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// View Questions Modal Component
function ViewQuestionsModal({
  bank,
  questions,
  onClose,
  onRemoveQuestion
}: {
  bank: QuestionBank;
  questions: QuestionBankItem[];
  onClose: () => void;
  onAddQuestion?: (bankId: number, questionId: number) => void;
  onRemoveQuestion?: (bankId: number, questionId: number) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{bank.name} - Questions</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-3">
          {questions.map((question) => (
            <div
              key={question.id}
              className="p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-900 mb-2">{question.question_text}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>{question.question_marks} marks</span>
                    <span>{question.bloom_level}</span>
                    <span>{question.difficulty_level}</span>
                    <span>Added by {question.added_by_name}</span>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveQuestion?.(bank.id, question.id)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
