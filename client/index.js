/* Browser entry using DSH's published module protocol and shared settings controls. */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-zuad-media',
  factory(require) {
    const React = require('react');
    const { SettingsForm, SettingsValueField, SettingsFormModel, settingsTextField } = require('@deepseek-ai/dsh-client-ui-primitives');
    const h = React.createElement;
    const groups = [
      ['connection', ['baseUrl', 'orgNum', 'actorUid', 'actorNickname']],
      ['advanced', ['timeoutMs']],
    ];
    const ranges = { timeoutMs: [1000, 300000] };
    const fields = groups.flatMap(([, names]) => names);
    const origin = text => {
      try {
        const url = new URL(text);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
      } catch { return false; }
    };
    const specs = fields.map(field => ({
      ...settingsTextField(field),
      format: value => value === undefined ? '' : String(value),
      parse(text) {
        const value = text.trim();
        if (!value) return { kind: 'clear' };
        if (field in ranges) {
          const number = Number(value), [min, max] = ranges[field];
          return Number.isInteger(number) && number >= min && number <= max ? { kind: 'set', value: number } : undefined;
        }
        if (field === 'baseUrl' && !origin(value)) return undefined;
        if (['orgNum', 'actorUid'].includes(field) && !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
        return { kind: 'set', value };
      },
    }));
    const zh = {
      title: '信发系统配置', connection: '系统连接', advanced: '高级设置',
      baseUrl: '后台地址', orgNum: '组织编号', actorUid: '操作用户 UID', actorNickname: '操作人名称',
      timeoutMs: '请求超时（毫秒）',
      save: '保存配置', saving: '保存中…', unavailable: '正在读取配置，或当前实例不可配置。',
      readOnly: '当前配置为只读。', saveFailed: '保存未成功。请检查配置或重新打开页面后重试。',
      overridden: '已设置', reset: '恢复默认', invalid: '请输入有效值。',
      invalidOrigin: '请输入 HTTP(S) 地址，不含路径、账号、查询参数或片段。',
      invalidId: '只能使用字母、数字、下划线和连字符。',
      invalidNumber: '请输入 {min} 到 {max} 之间的整数。',
    };
    const en = {
      title: 'Signage settings', connection: 'Connection', advanced: 'Advanced settings',
      baseUrl: 'Backend address', orgNum: 'Organization', actorUid: 'Actor UID', actorNickname: 'Actor name',
      timeoutMs: 'Request timeout (ms)',
      save: 'Save settings', saving: 'Saving…', unavailable: 'Loading settings, or this instance is unavailable.',
      readOnly: 'These settings are read-only.', saveFailed: 'Settings were not saved. Check the values or reopen this page and retry.',
      overridden: 'Configured', reset: 'Reset', invalid: 'Enter a valid value.',
      invalidOrigin: 'Enter an HTTP(S) origin without a path, credentials, query or fragment.',
      invalidId: 'Use only letters, numbers, underscores and hyphens.', invalidNumber: 'Enter an integer from {min} to {max}.',
    };
    function SettingsPage({ scope, t }) {
      const [model] = React.useState(() => new SettingsFormModel(scope, specs));
      const [store] = React.useState(() => model.bind(() => ({ ...model.shell(), fields: Object.fromEntries(fields.map(field => [field, model.field(field)])) })));
      const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
      React.useEffect(() => () => model.dispose(), [model]);
      const actions = React.useMemo(() => model.actions(), [model]);
      const disabled = !state.writable || state.saving;
      return h('section', { 'data-zuad-settings': '', 'aria-label': t('title'), style: { maxWidth: 760, minWidth: 0, width: '100%' } },
        h(SettingsForm, {
          labels: Object.fromEntries(['unavailable', 'readOnly', 'saveFailed', 'save', 'saving'].map(key => [key, t(key)])),
          state, onSave: actions.save, onDiscard: actions.discard,
        }, groups.map(([group, names]) => h('section', { key: group, style: { marginBottom: 24, minWidth: 0 } },
          h('h3', { style: { fontSize: 15, fontWeight: 600, margin: '0 0 16px' } }, t(group)),
          names.map(field => {
            const value = state.fields[field];
            let invalidLabel = t('invalid');
            if (field in ranges) invalidLabel = t('invalidNumber', { min: ranges[field][0], max: ranges[field][1] });
            if (field === 'baseUrl') invalidLabel = t('invalidOrigin');
            if (['orgNum', 'actorUid'].includes(field)) invalidLabel = t('invalidId');
            return h(SettingsValueField, {
              key: field, id: `zuad-setting-${field}`, label: t(field), ...value,
              overriddenLabel: t('overridden'), resetLabel: t('reset'), invalidLabel,
              numeric: field in ranges, disabled,
              onEdit: text => actions.edit(field, text), onReset: () => actions.resetField(field),
            });
          })))),
      );
    }
    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('zuadSettings', { zh, en }));
        const scope = ctx.configForms.get('zuad-media');
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config', key: 'dsh-plugin-zuad-media', locale: 'zuadSettings',
        }, ({ t }) => h(SettingsPage, { scope, t })));
        ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
          name: 'plugins.row.config', key: 'dsh-plugin-zuad-media#zuad-media', locale: 'zuadSettings',
        }, ({ t, view }) => view === 'summary' ? t('title') : h(SettingsPage, { scope, t })));
      },
    };
  },
});
