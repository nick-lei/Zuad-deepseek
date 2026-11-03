const media = (table, label, fields, options = {}) => ({ table, database: 'media', label, fields, scope: 'org_num', operations: 'query,create,update,delete', ...options });
const common = (table, label, fields, options = {}) => ({ ...media(table, label, fields, options), database: 'zuad_common' });
export const resources = {
    programs: media('think_layout', 'Programs', 'layout,template_id,pageWidth,pageHeight,content,generateHtml,generateScript,file_img,file_list,size'),
    templates: media('think_template', 'Layout templates', 'template_name,status,grouping_id,pageWidth,pageHeight,content,generateHtml,generateScript,file_img,file_list,template_size', { shared: true }),
    program_groups: media('think_layout_group', 'Program groups', 'group_name,layout_id,remark'),
    materials: media('think_media', 'Materials', 'sourceName,encryptionName,recordStart,fileMd5,fileSize,fileSourceType,filePreview,page_size,duration,grouping_id,means_code,change'),
    folders: media('think_grouping', 'Material (model_id=1) / template (2) folders', 'name,pid,model_id'),
    schedules: media('think_schedule', 'Schedules', 'schedule_name,layout_id,layout_code,device_id,device_code,play_id,layout_play_id,start_time,end_time,time_frame,appoint_date,color,condition'),
    insertions: media('think_urgent_insert', 'Urgent insertions', 'insertion_name,layout_id,layout_code,device_id,device_code,play_id,layout_play_id,start_time,end_time,condition'),
    devices: media('think_device', 'Devices: id is database ID, device_id is terminal serial', 'device_id,device_name,device_type_id,region_id,layout_id,layout_group_id,default_layout_id,default_type_code,remark', { joins: ['think_default_play'] }),
    device_groups: media('think_device_group', 'Device groups (device_id contains database IDs)', 'group_name,device_id,remark'),
    device_configs: media('think_device_config', 'Device information and screenshot result', 'device_id,url,last_time', { operations: 'query,update' }),
    regions: media('think_region', 'Regions', 'name,pid,remarks'),
    screens: media('think_screen', 'Screens', 'sort,device_id,name,width,height,region_id,type_id,ip,mark_id,remarks'),
    seats: media('think_seats', 'Legacy seats: queries snake_case, writes camelCase', 'seatsName,seatsIp,videoOutput,outputPort,remark', { writeScope: 'orgNum' }),
    fixed_times: media('think_fixed_time', 'Timed power', 'device_id,device_code,timing_type_code,shutdown_time,start_up_time,remark'),
    device_types: media('think_device_type', 'Types: module_code 1=input, 2=player/package', 'type_name,remark,module_code', { shared: true }),
    input_streams: media('think_input_stream', 'Input streams and cameras', 'sort,number,name,region_id,type_id,ip,mark_id,import_code,username,password,channel,rtsp'),
    monitors: media('think_monitor', 'Legacy monitors: queries snake_case, writes camelCase', 'number,monitorName,monitorIp,monitorTypeOid,markId,passage,regionOid,account,password,rtcName', { writeScope: 'orgNum' }),
    tasks: media('think_task', 'Task states: -1=requested,0=pending,1=running,2=success,3=failed', 'task_name,device_id,device_name,condition,layout_id,layout_group_id,layout_name,play_id,play_time,package_id,nickname', { operations: 'query,create,delete' }),
    play_history: media('think_play_history', 'Playback history', 'device_id,device_name,layout_id,layout_name,layout_code,play_duration', { operations: 'query,create,delete' }),
    downloads: media('think_download_log', 'Media download logs', 'device_id,layout_id', { joins: ['think_device', 'think_layout'], operations: 'query' }),
    people_details: media('think_people_counting', 'People counting details', 'device_id,create_time', { joins: ['think_default_play'] }),
    people_statistics: media('think_people_count', 'People counting statistics', 'device_id,create_time', { joins: ['think_default_play'] }),
    products: media('think_commodity', 'Products', 'commodity,quantity,price,company,discount,state'),
    packages: media('think_apk_renew', 'Player installation packages', 'file_id,version_code,describe,install_type,present_code,device_type_id', { joins: ['think_device_type', 'think_media'], shared: true }),
    plans: media('think_plan', 'Plans (writes use zuad_plan)', 'plan_name,layout_id,layout_code,remark,region_id', { operations: 'query' }),
    web_templates: media('think_web_url_list', 'Web signage templates', 'name,url,remark'),
    notices: media('think_notice', 'Notices', 'title,content', { operations: 'query' }),
    users: common('think_admin', 'Users', 'username,nickname,password,groupid,department_id,status,device_rules'),
    departments: common('think_department', 'Departments', 'name,pid,sort,remark'),
    organizations: common('think_organization', 'Current organization', 'org_name,validation,have_system,invite_code,multiple_user'),
    roles: common('think_auth_group', 'Roles and operation permissions', 'title,rules,device_rules,view_permissions,status,sort,system_code,default_code', { shared: true }),
    menus: common('think_auth_rule', 'Menus and permissions', 'name,title,pid,status,sort,system_code', { shared: true }),
    configs: common('think_config', 'System configuration', 'name,value,remark'),
    operation_logs: common('think_operation_log', 'Operation logs', 'describe,is_state,system_id,uid,create_time', { operations: 'query,create,delete' }),
    events: common('think_event', 'Error events (creation requires configured API key)', 'name,desc,operation,creator,deal_time,deal_with,system_id', { operations: 'query,create', apiKeyCreate: true }),
    authorizations: common('think_empower', 'Authorizations', 'name,device_id,start_time,end_time'),
    device_authorizations: common('think_device_empower', 'Device authorizations', 'device_id,empower_id', { operations: 'query,update' }),
    orders: common('think_order', 'Orders', 'order_number,name,quantity,univalent,creation_time,payment_method,total_price,creator_uuid', { operations: 'query,create,update', joins: ['think_organization'] }),
    flow_pools: common('think_flow_pool', 'Traffic pool', 'flow,total_traffic,used_already,authorize_total', { operations: 'query,create,update', joins: ['think_organization'] }),
    common_downloads: common('think_download_log', 'Common download logs', 'device_id', { operations: 'query' }),
};
export const createMetadata = {
    users: 'oid', departments: 'oid,create_time,last_time,system_code', menus: 'create_time,update_time,system_code',
    roles: 'oid,create_time,update_time,system_code', organizations: 'oid,create_time,update_time',
    authorizations: 'oid,uid,create_time,last_time', configs: 'oid,last_time', flow_pools: 'create_time,last_time', orders: 'creation_time',
    regions: 'oid,uid,create_time,last_time', folders: 'oid,uid,create_time,last_time', device_types: 'oid,uid,create_time',
    seats: 'oid,uid', monitors: 'oid,uid', screens: 'uid,create_time', devices: 'oid,uid,create_time',
    device_groups: 'oid,uid,create_time', program_groups: 'oid,uid,create_time', input_streams: 'uid,create_time',
    fixed_times: 'oid,uid,create_time', products: 'oid,uid,create_time', packages: 'uid,create_time,update_time',
    play_history: 'oid,uid,create_time,last_time', operation_logs: 'oid,uid,create_time,system_id',
};
export function resource(name) {
    if (!Object.hasOwn(resources, name))
        throw new Error(`Unknown resource: ${name}. Call zuad_catalog.`);
    return resources[name];
}
export function object(value, label = 'data') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${label} must be an object`);
    return value;
}
export function id(value) {
    const result = String(value ?? '');
    if (!/^[A-Za-z0-9_-]+$/.test(result) || result.length > 128)
        throw new Error('Invalid entity ID');
    return result;
}
export function ids(value) {
    const list = Array.isArray(value) ? value : String(value ?? '').split(',');
    const result = [...new Set(list.filter(v => String(v).trim()).map(v => id(String(v).trim())))];
    if (!result.length)
        throw new Error('At least one ID is required');
    return result;
}
//# sourceMappingURL=catalog.js.map