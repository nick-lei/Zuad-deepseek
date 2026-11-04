window.__ModuleLoader__.load({
  id: 'dsh-plugin-zuad-media',
  factory(require) {
    const React = require('react');
    const { Input, Button, StateDot, Tooltip, IconCordisPluginOutlineRegular, IconRefreshOutlineRegular, IconUserOutlineRegular } = require('@deepseek-ai/dsh-client-ui-primitives');
    const h = React.createElement;
    let focusLoginOnMount = false;
    const contribution = {
      package: 'dsh-plugin-zuad-media',
      descriptors: ['status', 'connect', 'disconnect'].map(method => ({
        id: `dsh-plugin-zuad-media#zuadMedia/${method}`, service: 'zuadMedia', namespace: 'zuadMedia', method,
        invocation: { kind: 'direct' }, parameters: [], result: { mode: 'src-json' },
      })),
    };
    const zh = {
      title: '连接信发系统', baseUrl: '后台地址', username: '账号', password: '密码',
      connect: '登录并连接', reconnect: '重新连接', connecting: '正在连接', logout: '退出登录',
      connected: '已连接', disconnected: '未连接', account: '当前用户', organization: '所属组织',
      switchAccount: '切换账号', cancel: '取消', checking: '正在读取连接状态', statusFailed: '无法读取连接状态', retry: '重试', signingOut: '正在退出', save: '保存配置',
      advanced: '高级配置', timeoutMs: '请求超时（秒）',
      savedPassword: '已保存，留空保持不变', enterPassword: '请输入后台登录密码',
      invalidOrigin: '请输入有效的 HTTP(S) 后台地址。', required: '请填写账号和密码。',
      accountChanged: '更换后台地址或账号后，请重新填写密码。',
      invalidTimeout: '请求超时应为 1 到 300 秒。',
      loginFailed: '登录失败，请核对账号和密码，或确认账号是否已停用。',
      accessDenied: '后台拒绝访问，请检查账号权限或重新登录。',
      connectionFailed: '连接未成功，请检查后台地址和网络后重试。',
      saveFailed: '配置保存失败，请重新打开页面后重试。',
      unavailable: '正在读取连接配置。', readOnly: '当前连接配置为只读。', apiKey: '管理员授权',
      openLogin: '登录信发系统', not_signed_in: '尚未登录信发系统', expired: '信发系统登录已失效', credentials_rejected: '请更新信发系统登录信息',
    };
    const en = {
      title: 'Connect signage system', baseUrl: 'Backend address', username: 'Account', password: 'Password',
      connect: 'Sign in and connect', reconnect: 'Reconnect', connecting: 'Connecting', logout: 'Sign out',
      connected: 'Connected', disconnected: 'Not connected', account: 'Current user', organization: 'Organization',
      switchAccount: 'Switch account', cancel: 'Cancel', checking: 'Checking connection', statusFailed: 'Connection status unavailable', retry: 'Retry', signingOut: 'Signing out', save: 'Save settings',
      advanced: 'Advanced settings', timeoutMs: 'Request timeout (seconds)',
      savedPassword: 'Saved; leave blank to keep', enterPassword: 'Enter your backend password',
      invalidOrigin: 'Enter a valid HTTP(S) backend address.', required: 'Enter your account and password.',
      accountChanged: 'Enter your password again after changing the address or account.',
      invalidTimeout: 'Use 1 to 300 seconds.',
      loginFailed: 'Sign-in failed. Check your account, password and account status.',
      accessDenied: 'Access denied. Check account permissions or sign in again.',
      connectionFailed: 'Could not connect. Check the backend address and network, then retry.',
      saveFailed: 'Settings could not be saved. Reopen the page and retry.',
      unavailable: 'Loading connection settings.', readOnly: 'These connection settings are read-only.', apiKey: 'Administrator authorization',
      openLogin: 'Sign in to signage', not_signed_in: 'Signage sign-in required', expired: 'Signage session expired', credentials_rejected: 'Update your signage credentials',
    };
    const normalizeOrigin = text => {
      try {
        const url = new URL(text.trim());
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || !['/', '/index.html'].includes(url.pathname)) return undefined;
        return url.origin;
      } catch { return undefined; }
    };
    const initialDraft = value => ({
      baseUrl: value?.baseUrl || '', username: value?.username || '', password: '',
      timeoutSeconds: String((value?.timeoutMs || 30000) / 1000),
    });
    function loginRequiredInTurn(snapshot, turn) {
      let latest = -1, reason = null;
      const visit = block => {
        if (!block) return;
        const name = block.call?.name || block.name || '';
        if (block.kind === 'tool-result' && /^zuad_/.test(name)) {
          for (const part of block.content || []) {
            if (part.type !== 'text') continue;
            let result;
            try { result = JSON.parse(part.text); } catch { continue; }
            if (!result || typeof result !== 'object') continue;
            const legacy = result.ok === false && /^Please (sign in to the signage system|enter your account and password) in the plugin details\./.test(result.error || '');
            const required = result.ok === false && (result.code === 'AUTH_REQUIRED' || legacy);
            const verified = result.ok === true && ['zuad_session', 'zuad_query'].includes(name);
            if ((required || verified) && block.seq >= latest) {
              latest = block.seq;
              reason = required ? ['expired', 'credentials_rejected'].includes(result.reason) ? result.reason : 'not_signed_in' : null;
            }
          }
        }
        for (const child of block.subCalls || []) visit(child);
      };
      for (const key of snapshot.locations.getTurn(turn)) {
        const node = snapshot.nodes.get(key);
        if (node?.kind === 'tool-call') visit(node.data.root);
      }
      return reason;
    }
    function LoginNotice({ reason, scope, remote, openLogin, t }) {
      const [connected, setConnected] = React.useState(false);
      React.useEffect(() => {
        let active = true, revision = 0;
        const refresh = () => {
          const request = ++revision;
          remote.status().then(result => { if (active && request === revision && result.ok) setConnected(Boolean(result.value.connected)); }).catch(() => {});
        };
        refresh();
        const unsubscribe = scope.subscribe(refresh);
        return () => { active = false; unsubscribe(); };
      }, [scope, remote]);
      if (connected) return null;
      return h('div', { 'data-zuad-login-entry': '', style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', padding: '12px 0', fontSize: 13 } },
        h('span', { role: 'status' }, t(reason)),
        h(Button, { type: 'button', variant: 'outline', size: 'sm', icon: h(IconCordisPluginOutlineRegular), onClick: openLogin }, t('openLogin')));
    }
    function LoginTail({ turn, useChat, ...props }) {
      const reason = useChat(snapshot => loginRequiredInTurn(snapshot, turn.turn));
      return reason === null || turn.status !== 'closed' ? null : h(LoginNotice, { ...props, reason });
    }
    function SettingsPage({ scope, remote, t }) {
      const subscription = React.useMemo(() => ({ subscribe: scope.subscribe.bind(scope), getSnapshot: scope.getSnapshot.bind(scope) }), [scope]);
      const snapshot = React.useSyncExternalStore(subscription.subscribe, subscription.getSnapshot, subscription.getSnapshot);
      const [draft, setDraft] = React.useState(() => initialDraft(snapshot.value));
      const [connection, setConnection] = React.useState(null);
      const [statusFailed, setStatusFailed] = React.useState(false);
      const [statusRetry, setStatusRetry] = React.useState(0);
      const [operation, setOperation] = React.useState('');
      const [editing, setEditing] = React.useState(false);
      const [focusField, setFocusField] = React.useState(null);
      const [error, setError] = React.useState('');
      const mounted = React.useRef(true);
      const dirty = React.useRef(false);
      const working = React.useRef(false);
      const statusRevision = React.useRef(0);
      const busy = Boolean(operation);
      const connected = Boolean(connection?.connected);
      const showLoginForm = Boolean(connection) && (!connected || editing);
      React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
      React.useEffect(() => { if (!dirty.current) setDraft(initialDraft(snapshot.value)); }, [snapshot.value]);
      React.useEffect(() => {
        if (snapshot.status !== 'ready' || !focusLoginOnMount) return;
        focusLoginOnMount = false;
        setEditing(true);
        setFocusField(snapshot.value?.username ? 'zuad-password' : 'zuad-username');
      }, [snapshot.status]);
      React.useEffect(() => {
        if (!focusField) return;
        const field = document.getElementById(focusField);
        if (!field) return;
        field?.focus({ preventScroll: true });
        field?.scrollIntoView({ block: 'center' });
        setFocusField(null);
      }, [focusField, showLoginForm]);
      React.useEffect(() => {
        let active = true;
        const refresh = async () => {
          const revision = ++statusRevision.current;
          if (working.current) return;
          try {
            const result = await remote.status();
            if (!active || revision !== statusRevision.current || working.current) return;
            if (!result.ok) throw new Error('transport');
            setConnection(result.value); setStatusFailed(false);
          } catch { if (active && revision === statusRevision.current && !working.current) setStatusFailed(true); }
        };
        const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
        refresh();
        const timer = window.setInterval(onVisible, 15000);
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', onVisible);
        return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVisible); };
      }, [remote, snapshot.value, statusRetry]);
      const writable = snapshot.status === 'ready' && snapshot.writable;
      const edit = (field, text) => { dirty.current = true; setDraft(value => ({ ...value, [field]: text })); setError(''); };
      const savedPassword = connection?.authMode === 'session' && connection.hasPassword;
      const changedAccount = normalizeOrigin(draft.baseUrl) !== snapshot.value?.baseUrl || draft.username.trim() !== (snapshot.value?.username || '');
      const timeoutChanged = draft.timeoutSeconds !== String((snapshot.value?.timeoutMs || 30000) / 1000);
      async function connect(event) {
        event.preventDefault();
        if (busy || !writable) return;
        const baseUrl = normalizeOrigin(draft.baseUrl), username = draft.username.trim(), timeout = Number(draft.timeoutSeconds);
        if (showLoginForm) {
          if (!baseUrl) { setError(t('invalidOrigin')); return; }
          if (!username || (!draft.password && !savedPassword)) { setError(t('required')); return; }
          if (changedAccount && !draft.password) { setError(t('accountChanged')); return; }
        }
        if (!Number.isFinite(timeout) || timeout < 1 || timeout > 300) { setError(t('invalidTimeout')); return; }
        working.current = true; ++statusRevision.current; setOperation('connect'); setError('');
        try {
          const values = showLoginForm ? { baseUrl, username, authMode: 'session', sessionEnabled: true, orgNum: '', timeoutMs: Math.round(timeout * 1000) }
            : timeoutChanged ? { timeoutMs: Math.round(timeout * 1000) } : {};
          if (showLoginForm && draft.password) values.password = draft.password;
          if (Object.keys(values).length && !await scope.mutate(Object.entries(values).map(([field, value]) => ({ op: 'set', path: [field], value })))) throw new Error('save');
          dirty.current = false;
          if (mounted.current) setDraft({ ...draft, baseUrl, username, password: '' });
          const response = await remote.connect();
          if (!mounted.current) return;
          if (!response.ok) throw new Error('transport');
          if (!response.value.ok) {
            const message = response.value.error || '';
            setConnection({ ...connection, connected: false, authMode: showLoginForm ? 'session' : connection.authMode, hasPassword: savedPassword || Boolean(draft.password) });
            setError(t(/Login rejected|Backend rejected|account and password/.test(message) ? 'loginFailed' : /401|403/.test(message) ? 'accessDenied' : 'connectionFailed'));
            return;
          }
          setConnection(response.value.data);
          setStatusFailed(false); setEditing(false);
          setDraft(value => ({ ...value, password: '' }));
          setFocusField('zuad-switch-account');
        } catch (failure) { if (mounted.current) setError(t(failure.message === 'save' ? 'saveFailed' : 'connectionFailed')); }
        finally { working.current = false; if (mounted.current) setOperation(''); }
      }
      async function disconnect() {
        if (busy || !writable) return;
        working.current = true; ++statusRevision.current; setOperation('logout'); setError('');
        try {
          if (!await scope.mutate([
            { op: 'set', path: ['authMode'], value: 'session' },
            { op: 'set', path: ['sessionEnabled'], value: false },
            { op: 'set', path: ['password'], value: '' },
          ])) throw new Error('save');
          const response = await remote.disconnect();
          if (!response.ok) throw new Error('transport');
          if (mounted.current) { dirty.current = false; setConnection(response.value); setEditing(false); setStatusFailed(false); setDraft(initialDraft(snapshot.value)); setFocusField('zuad-password'); }
        } catch (failure) { if (mounted.current) setError(t(failure.message === 'save' ? 'saveFailed' : 'connectionFailed')); }
        finally { working.current = false; if (mounted.current) setOperation(''); }
      }
      function editAccount() {
        dirty.current = false; setDraft(initialDraft(snapshot.value)); setEditing(true); setError(''); setFocusField('zuad-username');
      }
      function cancelEdit() {
        dirty.current = false; setDraft(initialDraft(snapshot.value)); setEditing(false); setError(''); setFocusField('zuad-switch-account');
      }
      const field = (name, options = {}) => h('div', { key: name, style: { display: 'grid', gap: 7, minWidth: 0 } },
        h('label', { htmlFor: `zuad-${name}`, style: { fontSize: 13, fontWeight: 500 } }, t(name)),
        h(Input, { id: `zuad-${name}`, name: `zuad-${name}`, value: draft[name], disabled: !writable || busy,
          onChange: event => edit(name, event.target.value), style: { width: '100%', minWidth: 0, boxSizing: 'border-box' }, ...options }));
      if (snapshot.status !== 'ready') return h('p', { role: 'status' }, t('unavailable'));
      const muted = { color: 'var(--dsw-alias-label-secondary, #657080)' };
      const fact = (label, value) => h(React.Fragment, { key: label },
        h('dt', { style: muted }, t(label)), h('dd', { style: { margin: 0, minWidth: 0, overflowWrap: 'anywhere' } }, value));
      const status = busy ? operation === 'logout' ? 'signingOut' : 'connecting' : statusFailed ? 'statusFailed' : !connection ? 'checking' : connected ? 'connected' : 'disconnected';
      return h('form', { 'data-zuad-settings': '', 'aria-label': t('title'), onSubmit: connect,
        style: { maxWidth: 640, width: '100%', minWidth: 0, display: 'grid', gap: 20, paddingTop: 4 } },
        h('div', { role: 'status', 'aria-live': 'polite', style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 24 } },
          h(StateDot, { state: busy || (!connection && !statusFailed) ? 'ongoing' : statusFailed ? 'idle' : connected ? 'done' : 'idle' }),
          h('span', { style: { fontSize: 14, fontWeight: 600 } }, t(status)),
          connection?.authMode === 'apiKey' ? h('span', { style: { fontSize: 12 } }, t('apiKey')) : null,
          statusFailed ? h(Button, { variant: 'outline', size: 'sm', icon: h(IconRefreshOutlineRegular), disabled: busy, onClick: () => setStatusRetry(value => value + 1) }, t('retry')) : null),
        !snapshot.writable ? h('p', null, t('readOnly')) : null,
        showLoginForm ? h('div', { 'data-zuad-login-form': '', style: { display: 'grid', gap: 18, minWidth: 0 } },
          field('baseUrl', { type: 'url', autoComplete: 'url', placeholder: 'https://your-signage.example.com' }),
          field('username', { autoComplete: 'username' }),
          field('password', { type: 'password', autoComplete: 'current-password', placeholder: t(savedPassword && !changedAccount ? 'savedPassword' : 'enterPassword') })) : null,
        connected && !editing ? h('dl', { 'data-zuad-connection-summary': '', style: { display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: '16px 24px', alignItems: 'baseline', margin: 0, fontSize: 13, lineHeight: 1.6 } },
          fact('baseUrl', connection.baseUrl),
          fact('account', h('div', null, h('div', { style: { fontWeight: 500 } }, connection.nickname || connection.username || connection.uid),
            connection.username && connection.nickname !== connection.username ? h('div', { style: { ...muted, fontSize: 12 } }, connection.username) : null)),
          connection.orgNum ? fact('organization', connection.orgNum) : null) : null,
        error ? h('p', { role: 'alert', style: { margin: 0, fontSize: 13, color: 'var(--dsw-alias-state-error, #b42318)', overflowWrap: 'anywhere' } }, error) : null,
        connection ? h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 } },
          showLoginForm ? h(Button, { type: 'submit', variant: 'primary', disabled: !writable || busy }, t(operation === 'connect' ? 'connecting' : 'connect')) :
            h(Tooltip, { label: t('reconnect'), side: 'top' }, h(Button, { type: 'submit', variant: 'outline', 'aria-label': t('reconnect'), icon: h(IconRefreshOutlineRegular), disabled: !writable || busy, style: { width: 36, height: 36, padding: 0, flexShrink: 0 } })),
          connected && !editing ? h(Button, { id: 'zuad-switch-account', variant: 'outline', icon: h(IconUserOutlineRegular), onClick: editAccount, disabled: !writable || busy }, t('switchAccount')) : null,
          editing ? h(Button, { variant: 'outline', onClick: cancelEdit, disabled: busy }, t('cancel')) : null,
          !editing && (connected || savedPassword) ? h(Button, { variant: 'ghost', onClick: disconnect, disabled: !writable || busy, style: muted }, t('logout')) : null) : null,
        connection ? h('details', { style: { borderTop: '1px solid var(--dsw-alias-border-l4, #e8e9ec)', paddingTop: 16 } },
          h('summary', { style: { cursor: 'pointer', fontSize: 13 } }, t('advanced')),
          h('div', { style: { display: 'grid', gap: 7, minWidth: 0, marginTop: 16 } },
            h('label', { htmlFor: 'zuad-timeoutSeconds', style: { fontSize: 13 } }, t('timeoutMs')),
            h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' } },
              h(Input, { id: 'zuad-timeoutSeconds', type: 'number', min: 1, max: 300, value: draft.timeoutSeconds, disabled: !writable || busy,
                onChange: event => edit('timeoutSeconds', event.target.value), style: { width: 128, maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' } }),
              connected && !editing && timeoutChanged ? h(Button, { type: 'submit', variant: 'outline', disabled: !writable || busy }, t('save')) : null))) : null);
    }
    return {
      inject: ['slots', 'locale', 'configForms', 'remote'],
      async apply(ctx) {
        ctx.effect(() => ctx.locale.register('zuadSettings', { zh, en }));
        await ctx.remote.$mount(contribution);
        ctx.inject(['remote.zuadMedia'], connectionCtx => {
          const scope = connectionCtx.configForms.get('zuad-media');
          const render = t => h(SettingsPage, { scope, remote: connectionCtx.remote.zuadMedia, t });
          connectionCtx.slots.inject('plugins.bundle.config', () => connectionCtx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-plugin-zuad-media', locale: 'zuadSettings' }, ({ t }) => render(t)));
          connectionCtx.slots.inject('plugins.row.config', () => connectionCtx.slots.register({ name: 'plugins.row.config', key: 'dsh-plugin-zuad-media#zuad-media', locale: 'zuadSettings' }, ({ t, view }) => view === 'summary' ? t('title') : render(t)));
          connectionCtx.inject(['pluginNavigation'], navigationCtx => {
            navigationCtx.slots.inject('conversation.chat.turnTail', () => navigationCtx.slots.register({
              name: 'conversation.chat.turnTail', id: 'dsh-plugin-zuad-media.login', locale: 'zuadSettings',
              inject: () => ({ scope, remote: connectionCtx.remote.zuadMedia,
                openLogin: () => { focusLoginOnMount = true; navigationCtx.pluginNavigation.openBundle('dsh-plugin-zuad-media'); } }),
            }, LoginTail));
          });
        });
      },
    };
  },
});
