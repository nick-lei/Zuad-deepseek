import { MediaClient, type Data } from './client.js';
import { type ResourceName } from './catalog.js';
export declare const commands: readonly ["update_app", "upload_screenshot", "upload_device_info", "reboot_device", "sleep", "wake", "remove_file", "start_debug", "stop_debug", "restore_factory", "del_device", "reg_device"];
export interface Target {
    kind: 'program' | 'group';
    id: string;
}
export interface ScheduleInput {
    kind: 'schedule' | 'insertion';
    name: string;
    target: Target;
    deviceKind: 'device' | 'group';
    deviceId: string;
    startTime: number;
    endTime: number;
    dates?: string[];
    color?: string;
    id?: string;
}
export declare function requireWrite(result: unknown): string | number;
export declare class MediaService {
    readonly client: MediaClient;
    private mutations;
    constructor(client: MediaClient);
    serialize<T>(fn: () => Promise<T>): Promise<T>;
    catalog(name?: string): {
        generatedOnCreate: string;
        fieldsAreExamples: boolean;
        table: string;
        database: "media" | "zuad_common";
        label: string;
        fields: string;
        scope: string;
        writeScope?: string;
        apiKeyCreate?: boolean;
        shared?: boolean;
        joins?: string[];
        operations: string;
        resource: string;
        resources?: never;
        workflows?: never;
        note?: never;
    } | {
        resources: {
            programs: import("./catalog.js").Resource;
            templates: import("./catalog.js").Resource;
            program_groups: import("./catalog.js").Resource;
            materials: import("./catalog.js").Resource;
            folders: import("./catalog.js").Resource;
            schedules: import("./catalog.js").Resource;
            insertions: import("./catalog.js").Resource;
            devices: import("./catalog.js").Resource;
            device_groups: import("./catalog.js").Resource;
            device_configs: import("./catalog.js").Resource;
            regions: import("./catalog.js").Resource;
            screens: import("./catalog.js").Resource;
            seats: import("./catalog.js").Resource;
            fixed_times: import("./catalog.js").Resource;
            device_types: import("./catalog.js").Resource;
            input_streams: import("./catalog.js").Resource;
            monitors: import("./catalog.js").Resource;
            tasks: import("./catalog.js").Resource;
            play_history: import("./catalog.js").Resource;
            downloads: import("./catalog.js").Resource;
            people_details: import("./catalog.js").Resource;
            people_statistics: import("./catalog.js").Resource;
            products: import("./catalog.js").Resource;
            packages: import("./catalog.js").Resource;
            plans: import("./catalog.js").Resource;
            web_templates: import("./catalog.js").Resource;
            notices: import("./catalog.js").Resource;
            users: import("./catalog.js").Resource;
            departments: import("./catalog.js").Resource;
            organizations: import("./catalog.js").Resource;
            roles: import("./catalog.js").Resource;
            menus: import("./catalog.js").Resource;
            configs: import("./catalog.js").Resource;
            operation_logs: import("./catalog.js").Resource;
            events: import("./catalog.js").Resource;
            authorizations: import("./catalog.js").Resource;
            device_authorizations: import("./catalog.js").Resource;
            orders: import("./catalog.js").Resource;
            flow_pools: import("./catalog.js").Resource;
            common_downloads: import("./catalog.js").Resource;
        };
        generatedOnCreate: Partial<Record<"programs" | "templates" | "program_groups" | "materials" | "folders" | "schedules" | "insertions" | "devices" | "device_groups" | "device_configs" | "regions" | "screens" | "seats" | "fixed_times" | "device_types" | "input_streams" | "monitors" | "tasks" | "play_history" | "downloads" | "people_details" | "people_statistics" | "products" | "packages" | "plans" | "web_templates" | "notices" | "users" | "departments" | "organizations" | "roles" | "menus" | "configs" | "operation_logs" | "events" | "authorizations" | "device_authorizations" | "orders" | "flow_pools" | "common_downloads", string>>;
        workflows: string[];
        note: string;
    };
    target(target: Target, signal?: AbortSignal): Promise<{
        record: Data;
        programIds: string[];
        fields: {
            layout_id: any;
            layout_group_id: any;
            layout_name: any;
            play_id: string;
        };
    }>;
    devices(deviceIds: string[], groupIds?: string[], signal?: AbortSignal): Promise<Data[]>;
    audit(description: string, signal?: AbortSignal): Promise<string | undefined>;
    private clearPending;
    private perDevice;
    publish(target: Target, deviceIds: string[], groupIds?: string[], signal?: AbortSignal): Promise<{
        results: Data[];
        unprocessedDeviceIds: any[];
        note: string;
    }>;
    command(command: string, deviceIds: string[], groupIds?: string[], packageId?: string, signal?: AbortSignal): Promise<{
        results: Data[];
        unprocessedDeviceIds: any[];
        note: string;
    }>;
    defaultPlayback(target: Target, deviceIds: string[], groupIds?: string[], signal?: AbortSignal): Promise<{
        results: Data[];
        unprocessedDeviceIds: any[];
        note: string;
    }>;
    schedule(input: ScheduleInput, signal?: AbortSignal): Promise<{
        saved: boolean;
        conflicts: any[];
        reason: string;
        result?: never;
        warning?: never;
    } | {
        saved: boolean;
        result: any;
        warning: string;
        conflicts?: never;
        reason?: never;
    }>;
    plan(operation: string, input: Data, signal?: AbortSignal): Promise<any>;
    crud(operation: string, name: ResourceName, input: Data, entityId?: string, signal?: AbortSignal): Promise<{
        result: any;
        warning: string | null;
    }>;
}
export declare function scheduleIntervals(row: Data): [number, number][];
