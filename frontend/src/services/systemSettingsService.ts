import api from './api';

export interface SystemImageSetting {
  id?: number;
  instance_type: string;
  display_name: string;
  image: string;
  is_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LDAPConfig {
  enabled: boolean;
  host: string;
  port: number;
  use_ssl: boolean;
  base_dn: string;
  bind_dn: string;
  bind_password: string;
  user_search_filter: string;
  user_search_base_dn: string;
  username_attribute: string;
  email_attribute: string;
  name_attribute: string;
  ldap_filter: string;
  allow_username_or_email_login: boolean;
  auto_create_user: boolean;
  group_base_dn: string;
  admin_group: string;
}

export const systemSettingsService = {
  getImageSettings: async (): Promise<SystemImageSetting[]> => {
    const response = await api.get('/system-settings/images');
    return (response.data.data?.items ?? []).map((item: SystemImageSetting) => ({
      ...item,
      id: item.id && item.id > 0 ? item.id : undefined,
    }));
  },

  saveImageSetting: async (setting: SystemImageSetting): Promise<SystemImageSetting> => {
    const response = await api.put('/system-settings/images', setting);
    return response.data.data;
  },

  deleteImageSetting: async (target: number | string): Promise<void> => {
    await api.delete(`/system-settings/images/${target}`);
  },

  getLDAPConfig: async (): Promise<LDAPConfig> => {
    const response = await api.get('/admin/system-settings/ldap');
    return response.data.data;
  },

  saveLDAPConfig: async (config: LDAPConfig): Promise<void> => {
    await api.put('/admin/system-settings/ldap', config);
  },

  testLDAPConnection: async (config: LDAPConfig): Promise<{ success: boolean; error?: string }> => {
    const response = await api.post('/admin/system-settings/ldap/test', config);
    return response.data.data;
  },
};
