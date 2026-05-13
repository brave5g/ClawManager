import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useI18n } from '../../contexts/I18nContext';
import { userService } from '../../services/userService';
import type { CreateUserRequest, ImportUsersResponse } from '../../services/userService';
import type { User, UserQuota } from '../../types/user';

const USERS_PAGE_SIZE = 20;

const UserManagementPage: React.FC = () => {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [rejectedUsers, setRejectedUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [rejectedLoading, setRejectedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'rejected'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportUsersResponse | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [newUser, setNewUser] = useState<CreateUserRequest>({
    username: '',
    email: '',
    password: '',
    role: 'user',
  });

  const loadUsers = useCallback(async (targetPage: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await userService.getUsers(targetPage, USERS_PAGE_SIZE);
      const total = data.total || 0;
      const maxPage = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));

      if (targetPage > maxPage) {
        setUsers([]);
        setTotalUsers(total);
        setPage(maxPage);
        return;
      }

      setUsers(data.users || []);
      setTotalUsers(total);
      setPage(data.page || targetPage);
    } catch (err: unknown) {
      setError(getRequestErrorMessage(err, t('userManagementPage.loadFailed')));
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadUsers(page);
  }, [loadUsers, page]);

  useEffect(() => {
    if (activeTab === 'pending') {
      void loadPendingUsers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'rejected') {
      void loadRejectedUsers();
    }
  }, [activeTab]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PAGE_SIZE));
  const showingFrom = totalUsers === 0 ? 0 : (page - 1) * USERS_PAGE_SIZE + 1;
  const showingTo = Math.min(page * USERS_PAGE_SIZE, totalUsers);

  const loadPendingUsers = async () => {
    try {
      setPendingLoading(true);
      setError(null);
      const data = await userService.getPendingUsers();
      setPendingUsers(data.users || []);
    } catch (err: any) {
      setError(err.response?.data?.error || t('userManagementPage.loadPendingFailed'));
      setPendingUsers([]);
    } finally {
      setPendingLoading(false);
    }
  };

  const loadRejectedUsers = async () => {
    try {
      setRejectedLoading(true);
      setError(null);
      const data = await userService.getRejectedUsers();
      setRejectedUsers(data.users || []);
    } catch (err: any) {
      setError(err.response?.data?.error || t('userManagementPage.loadRejectedFailed'));
      setRejectedUsers([]);
    } finally {
      setRejectedLoading(false);
    }
  };

  const handleApproveUser = async (user: User) => {
    try {
      await userService.approveUser(user.id, 'approve');
      setPendingUsers((current) => current.filter((u) => u.id !== user.id));
      void loadUsers(page);
    } catch (err: any) {
      setError(err.response?.data?.error || t('userManagementPage.approveFailed'));
    }
  };

  const handleRejectUser = async (user: User) => {
    try {
      await userService.approveUser(user.id, 'reject');
      setPendingUsers((current) => current.filter((u) => u.id !== user.id));
    } catch (err: any) {
      setError(err.response?.data?.error || t('userManagementPage.rejectFailed'));
    }
  };

  const handleReapproveUser = async (user: User) => {
    try {
      await userService.approveUser(user.id, 'approve');
      setRejectedUsers((current) => current.filter((u) => u.id !== user.id));
      void loadUsers(page);
    } catch (err: any) {
      setError(err.response?.data?.error || t('userManagementPage.approveFailed'));
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await userService.deleteUser(userToDelete.id);
      const nextTotal = Math.max(0, totalUsers - 1);
      const nextPage = Math.min(page, Math.max(1, Math.ceil(nextTotal / USERS_PAGE_SIZE)));
      setShowDeleteModal(false);
      setUserToDelete(null);
      await loadUsers(nextPage);
    } catch (err: unknown) {
      setError(getRequestErrorMessage(err, t('userManagementPage.deleteFailed')));
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  const handleEditQuota = async (user: User) => {
    try {
      const userQuota = await userService.getUserQuota(user.id);
      setQuota(userQuota);
      setSelectedUser(user);
      setShowQuotaModal(true);
    } catch (err: unknown) {
      setError(getRequestErrorMessage(err, t('userManagementPage.loadQuotaFailed')));
    }
  };

  const handleSaveQuota = async () => {
    if (!selectedUser || !quota) return;

    try {
      await userService.updateQuota(selectedUser.id, {
        max_instances: quota.max_instances,
        max_cpu_cores: quota.max_cpu_cores,
        max_memory_gb: quota.max_memory_gb,
        max_storage_gb: quota.max_storage_gb,
        max_gpu_count: quota.max_gpu_count,
      });
      setShowQuotaModal(false);
      setSelectedUser(null);
      setQuota(null);
    } catch (err: unknown) {
      setError(getRequestErrorMessage(err, t('userManagementPage.updateQuotaFailed')));
    }
  };

  const handleEditRole = (user: User) => {
    setSelectedUser(user);
    setShowRoleModal(true);
  };

  const handleSaveRole = async (newRole: 'admin' | 'user') => {
    if (!selectedUser) return;

    try {
      await userService.updateRole(selectedUser.id, { role: newRole });
      setUsers((current) => current.map((user) => (
        user.id === selectedUser.id ? { ...user, role: newRole } : user
      )));
      setShowRoleModal(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      setError(getRequestErrorMessage(err, t('userManagementPage.updateRoleFailed')));
    }
  };

  const handleAddUser = async () => {
    try {
      await userService.createUser(newUser);
      setShowAddModal(false);
      setNewUser({ username: '', email: '', password: '', role: 'user' });
      await loadUsers(page);
    } catch (err: unknown) {
      setError(getRequestErrorMessage(err, t('userManagementPage.createFailed')));
    }
  };

  const handleImportUsers = async () => {
    if (!importFile) {
      setError(t('userManagementPage.selectCsv'));
      return;
    }

    try {
      setImporting(true);
      setError(null);
      const result = await userService.importUsers(importFile);
      setImportResult(result);
      setShowImportModal(false);
      setImportFile(null);
      await loadUsers(1);
    } catch (err: unknown) {
      setError(getRequestErrorMessage(err, t('userManagementPage.importFailed')));
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      [
        'Username',
        'Email',
        'Role',
        'Password (optional)',
        'Max Instances',
        'Max CPU Cores',
        'Max Memory (GB)',
        'Max Storage (GB)',
        'Max GPU Count (optional)',
      ],
      ['alice', 'alice@example.com', 'user', '', '10', '40', '100', '500', '2'],
      ['bob', '', 'admin', 'admin123', '20', '80', '200', '1000', '4'],
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clawmanager-user-import-template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleModalBackgroundClick = (e: React.MouseEvent, closeFn: () => void) => {
    if (e.target === e.currentTarget) {
      closeFn();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{t('userManagementPage.loading')}</div>
      </div>
    );
  }

  return (
    <AdminLayout title={t('admin.userManagement')}>
      <div className="mb-6 flex justify-end gap-3">
        <button onClick={() => setShowImportModal(true)} className="app-button-secondary">
          {t('userManagementPage.importUsers')}
        </button>
        <button onClick={() => setShowAddModal(true)} className="app-button-primary">
          {t('admin.addUser')}
        </button>
      </div>

      <div className="mb-4 flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'all'
              ? 'border-b-2 border-indigo-500 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('userManagementPage.allUsers')}
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'pending'
              ? 'border-b-2 border-indigo-500 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('userManagementPage.pendingUsers')}
          {pendingUsers.length > 0 && (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'rejected'
              ? 'border-b-2 border-indigo-500 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('userManagementPage.rejectedUsers')}
          {rejectedUsers.length > 0 && (
            <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
              {rejectedUsers.length}
            </span>
          )}
        </button>
      </div>

      <div className="space-y-4">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {importResult && (
          <div className="app-panel mb-4 px-4 py-4 text-sm text-[#5f5957]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium text-[#171212]">
                  {t('userManagementPage.importCompleted', {
                    created: importResult.created_count,
                    failed: importResult.failed_count,
                  })}
                </div>
                <div className="mt-1 text-[#8f5b4b]">
                  {t('userManagementPage.expectedColumns')} <code>Username,Email,Role,Password (optional),Max Instances,Max CPU Cores,Max Memory (GB),Max Storage (GB),Max GPU Count (optional)</code>
                </div>
              </div>
              <button
                onClick={() => setImportResult(null)}
                className="text-[#8f5b4b] hover:text-[#171212]"
              >
                ×
              </button>
            </div>
            {importResult.errors.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-[#eadfd8] bg-white p-3">
                <ul className="space-y-2">
                  {importResult.errors.map((item, index) => (
                    <li key={`${item.line}-${index}`} className="text-sm text-[#5f5957]">
                      {t('userManagementPage.lineError', {
                        line: item.line,
                        username: item.username ? ` (${item.username})` : '',
                      })}: {item.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {importResult.created_users.length > 0 && (
              <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-[#eadfd8] bg-white p-3">
                <div className="mb-2 text-sm font-medium text-[#171212]">{t('userManagementPage.createdAccounts')}</div>
                <ul className="space-y-2">
                  {importResult.created_users.map((item, index) => (
                    <li key={`${item.username}-${index}`} className="rounded-md bg-[#fff8f5] px-3 py-2 text-sm text-[#5f5957]">
                      <div><span className="font-medium text-[#171212]">{item.username}</span> · {item.role}</div>
                      <div>{t('auth.email')}: {item.email}</div>
                      <div>
                        {t('userManagementPage.quota')}: {item.max_instances} / {item.max_cpu_cores} CPU / {item.max_memory_gb} GB / {item.max_storage_gb} GB / {item.max_gpu_count} GPU
                      </div>
                      <div>{t('userManagementPage.initialPassword')}: <code>{item.initial_password}</code></div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'all' ? (
          <div className="app-panel">
            {users.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                {t('userManagementPage.noUsers')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('auth.username')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('auth.email')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('admin.role')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.status')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('userManagementPage.source')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.createdAt')}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('aiAuditPage.action')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{user.username}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {user.role === 'admin' ? t('common.admin') : t('common.user')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.source === 'ldap'
                              ? user.approval_status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : user.approval_status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              : user.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {user.source === 'ldap'
                              ? user.approval_status === 'approved'
                                ? t('userManagementPage.approved')
                                : user.approval_status === 'pending'
                                  ? t('userManagementPage.pending')
                                  : t('userManagementPage.rejected')
                              : user.is_active
                                ? t('modelManagementPage.active')
                                : t('modelManagementPage.inactive')
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.source === 'ldap'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.source === 'ldap' ? 'LDAP' : t('userManagementPage.local')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEditQuota(user)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            {t('userManagementPage.quota')}
                          </button>
                          <button
                            onClick={() => handleEditRole(user)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            {t('admin.role')}
                          </button>
                          <button
                            onClick={() => handleDeleteClick(user)}
                            className="text-red-600 hover:text-red-900"
                          >
                            {t('common.delete')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalUsers > 0 && (
              <div className="flex flex-col gap-3 border-t border-gray-200 px-6 py-4 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {t('userManagementPage.showingUsers', {
                    from: showingFrom,
                    to: showingTo,
                    total: totalUsers,
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('admin.prev')}
                  </button>
                  <span>
                    {t('admin.pageSummary', { page, total: totalPages })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                    className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('admin.nextPage')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'pending' ? (
          <div className="app-panel">
            {pendingLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">{t('userManagementPage.loading')}</div>
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">{t('userManagementPage.noPendingUsers')}</div>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('auth.username')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('auth.email')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.role')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('userManagementPage.source')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.createdAt')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('userManagementPage.initialPassword')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('aiAuditPage.action')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {user.role === 'admin' ? t('common.admin') : t('common.user')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.source === 'ldap'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.source === 'ldap' ? 'LDAP' : t('userManagementPage.local')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <code className="bg-gray-100 px-2 py-1 rounded">user123</code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleApproveUser(user)}
                          className="text-green-600 hover:text-green-900 mr-4"
                        >
                          {t('userManagementPage.approve')}
                        </button>
                        <button
                          onClick={() => handleRejectUser(user)}
                          className="text-red-600 hover:text-red-900"
                        >
                          {t('userManagementPage.reject')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="app-panel">
            {rejectedLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">{t('userManagementPage.loading')}</div>
              </div>
            ) : rejectedUsers.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">{t('userManagementPage.noRejectedUsers')}</div>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('auth.username')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('auth.email')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.role')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('userManagementPage.source')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.createdAt')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('userManagementPage.initialPassword')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('aiAuditPage.action')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rejectedUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {user.role === 'admin' ? t('common.admin') : t('common.user')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.source === 'ldap'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.source === 'ldap' ? 'LDAP' : t('userManagementPage.local')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <code className="bg-gray-100 px-2 py-1 rounded">user123</code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleReapproveUser(user)}
                          className="text-green-600 hover:text-green-900 mr-4"
                        >
                          {t('userManagementPage.reapprove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showImportModal && (
        <div
          className="fixed inset-0 h-full w-full overflow-y-auto bg-gray-600 bg-opacity-50"
          onClick={(e) => handleModalBackgroundClick(e, () => setShowImportModal(false))}
        >
          <div className="relative top-20 mx-auto w-[28rem] rounded-md border bg-white p-5 shadow-lg">
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              {t('userManagementPage.importUsers')}
            </h3>
            <div className="space-y-4">
              <div className="rounded-lg border border-[#eadfd8] bg-[#fff8f5] p-3 text-sm text-[#5f5957]">
                <div className="font-medium text-[#171212]">{t('userManagementPage.supportedFormat')}</div>
                <div className="mt-1">{t('userManagementPage.csvHeaders')}</div>
                <code className="mt-2 block rounded bg-white px-2 py-1 text-xs">Username,Email,Role,Password (optional),Max Instances,Max CPU Cores,Max Memory (GB),Max Storage (GB),Max GPU Count (optional)</code>
                <div className="mt-2 text-xs text-[#8f5b4b]">
                  {t('userManagementPage.csvHelp')}
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="mt-3 inline-flex items-center rounded-md border border-[#eadfd8] bg-white px-3 py-2 text-sm font-medium text-[#5f5957] hover:bg-[#fff2ea]"
                >
                  {t('userManagementPage.downloadTemplate')}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('userManagementPage.importFile')}
                </label>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="rounded-md bg-[#ef4444] px-4 py-2 text-sm font-medium text-white hover:bg-[#dc2626]"
                  >
                    {t('userManagementPage.chooseFile')}
                  </button>
                  <span className="text-sm text-gray-500">
                    {importFile ? importFile.name : t('userManagementPage.noFileSelected')}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                className="rounded-md bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleImportUsers}
                disabled={!importFile || importing}
                className="rounded-md bg-[#ef4444] px-4 py-2 text-white hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? t('userManagementPage.importing') : t('userManagementPage.startImport')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full"
          onClick={(e) => handleModalBackgroundClick(e, () => setShowAddModal(false))}
        >
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {t('userManagementPage.addNewUser')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('auth.username')}
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder={t('auth.usernamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder={t('auth.enterEmail')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('admin.role')}
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'user' })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="user">{t('common.user')}</option>
                  <option value="admin">{t('common.admin')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('auth.password')}
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder={t('auth.passwordPlaceholder')}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewUser({ username: '', email: '', password: '', role: 'user' });
                }}
                className="rounded-md bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddUser}
                className="rounded-md bg-[#ef4444] px-4 py-2 text-white hover:bg-[#dc2626]"
              >
                {t('admin.addUser')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuotaModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full"
          onClick={(e) => handleModalBackgroundClick(e, () => setShowQuotaModal(false))}
        >
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {t('userManagementPage.editQuota', { username: selectedUser?.username })}
            </h3>
            {quota && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('userManagementPage.maxInstances')}
                  </label>
                  <input
                    type="number"
                    value={quota.max_instances}
                    onChange={(e) => setQuota({ ...quota, max_instances: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('userManagementPage.maxCPU')}
                  </label>
                  <input
                    type="number"
                    value={quota.max_cpu_cores}
                    onChange={(e) => setQuota({ ...quota, max_cpu_cores: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('userManagementPage.maxMemory')}
                  </label>
                  <input
                    type="number"
                    value={quota.max_memory_gb}
                    onChange={(e) => setQuota({ ...quota, max_memory_gb: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('userManagementPage.maxStorage')}
                  </label>
                  <input
                    type="number"
                    value={quota.max_storage_gb}
                    onChange={(e) => setQuota({ ...quota, max_storage_gb: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('userManagementPage.maxGPU')}
                  </label>
                  <input
                    type="number"
                    value={quota.max_gpu_count}
                    onChange={(e) => setQuota({ ...quota, max_gpu_count: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowQuotaModal(false);
                  setSelectedUser(null);
                  setQuota(null);
                }}
                className="rounded-md bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveQuota}
                className="rounded-md bg-[#ef4444] px-4 py-2 text-white hover:bg-[#dc2626]"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full"
          onClick={(e) => handleModalBackgroundClick(e, () => setShowRoleModal(false))}
        >
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {t('userManagementPage.editRole', { username: selectedUser?.username })}
            </h3>
            <div className="space-y-4">
              <select
                value={selectedUser?.role || 'user'}
                onChange={(e) => handleSaveRole(e.target.value as 'admin' | 'user')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="user">{t('common.user')}</option>
                <option value="admin">{t('common.admin')}</option>
              </select>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                }}
                className="rounded-md bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleSaveRole(selectedUser?.role === 'admin' ? 'user' : 'admin')}
                className="rounded-md bg-[#ef4444] px-4 py-2 text-white hover:bg-[#dc2626]"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full"
          onClick={(e) => handleModalBackgroundClick(e, () => handleCancelDelete())}
        >
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {t('userManagementPage.confirmDelete')}
            </h3>
            <p className="text-gray-500 mb-4">
              {t('userManagementPage.deleteWarning', { username: userToDelete?.username })}
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancelDelete}
                className="rounded-md bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded-md bg-red-500 px-4 py-2 text-white hover:bg-red-600"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

function getRequestErrorMessage(err: unknown, defaultMessage: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as Record<string, unknown>).message);
  }
  return defaultMessage;
}

export default UserManagementPage;
