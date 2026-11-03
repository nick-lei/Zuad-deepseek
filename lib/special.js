import { id } from './catalog.js';
export class SpecialOperations {
    client;
    files;
    constructor(client, files) {
        this.client = client;
        this.files = files;
    }
    async monitor(operation, input, signal) {
        const user = await (operation === 'ptz' ? this.client.login(signal) : this.client.actor(signal));
        if (operation === 'start_webrtc') {
            const monitor = await this.client.get('monitors', id(input.id), signal);
            if (!monitor.oid)
                throw new Error('Monitor has no oid');
            return this.client.request('/api/v5/monitor_model/startUpWebRtc', 'POST', { oid: monitor.oid, orgNum: user.orgNum, uid: user.uid }, {}, signal);
        }
        if (operation === 'export') {
            if (typeof input.outputPath !== 'string')
                throw new Error('outputPath is required');
            const bytes = await this.client.request('/api/v5/monitor_model/exportMonitor', 'GET', undefined, { orgNum: user.orgNum, uid: user.uid }, signal, true);
            return { path: await this.files.savePreview(input.outputPath, bytes) };
        }
        if (operation === 'ptz') {
            if (!this.client.config.ptzBaseUrl)
                throw new Error('Configure ptzBaseUrl');
            const monitor = await this.client.get('monitors', id(input.id), signal);
            const rtc = String(monitor.rtc_name ?? monitor.rtcName ?? '');
            const [terminal, channel] = rtc.slice(rtc.lastIndexOf('/') + 1).split('@');
            if (!terminal || !channel)
                throw new Error('Monitor rtc_name does not contain terminal@channel');
            if (typeof input.command !== 'string' || !/^[a-zA-Z0-9_]+$/.test(input.command))
                throw new Error('Valid PTZ command is required (gateway command vocabulary)');
            return this.client.request('/api/v1/gb28181', 'GET', undefined, { action: 'sip_ptz', id: id(terminal), chid: id(channel), ptzcmd: input.command, speed: 136 }, signal, false, false, true);
        }
        throw new Error('Invalid monitor operation');
    }
    async payment(orderId, signal) {
        if (!this.client.config.paymentGateway)
            throw new Error('Configure the trusted paymentGateway domain_interface');
        const order = await this.client.get('orders', orderId, signal);
        if (!order.order_number || !order.name || !(Number(order.total_price) > 0))
            throw new Error('Order has no valid number/name/price');
        const form = new FormData();
        form.set('domain_interface', this.client.config.paymentGateway);
        form.set('number', String(order.order_number));
        form.set('describe', String(order.name));
        form.set('price', String(order.total_price));
        const result = await this.client.request('/api/procReqsModel.php?method=ProxyPayment', 'POST', form, {}, signal);
        return { created: typeof result?.code_url === 'string' && !!result.code_url, result,
            note: 'Inspect the provider result and code_url. Payment completion is determined by the provider and backend order state.' };
    }
}
//# sourceMappingURL=special.js.map