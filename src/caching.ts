import { isEqual } from "lodash";

export class SceneCache {
    items: Map<string, object>;

    constructor() {
        this.items = new Map();
    }

    update(id: string, item: object) {
        const changed = this.items.has(id) ? !isEqual(this.items.get(id), item) : true;
        this.items.set(id, item);
        return changed;
    }

    get(id: string) {
        return this.items.get(id);
    }

    delete(id: string) {
        this.items.delete(id);
    }

    clear() {
        this.items.clear();
    }
}

type Cached<T, C> = T & {
    clearCache: () => void;
    setMaxCacheSize: (size: number) => void;
    cache: readonly C[];
};

function baseEquality(oldArg: unknown, newArg: unknown) {
    return oldArg === newArg;
}

export function cached<Args extends readonly unknown[], Return>(
    func: (...args: Args) => Return, ...equalities: ((oldArg: Args[number], newArg: Args[number]) => boolean)[]
): Cached<(...args: Args) => Return, [Args, Return]> {
    const cache: [Args, Return][] = [];
    let maxCacheSize = +Infinity;

    function wrapper(...args: Args): Return {
        for (const [cacheEntryArgs, cacheEntryReturn] of cache) {
            let matched = true;
            for (let i = 0; i < args.length; i++) {
                const equals = equalities[i] ?? baseEquality;
                if (cacheEntryArgs.length <= i || !equals(cacheEntryArgs[i], args[i])) {
                    matched = false;
                    break;
                }
            }
            if (matched) return cacheEntryReturn;
        }
        const newResult = func(...args);
        if (cache.length >= maxCacheSize) {
            cache.splice(0, 1);
        }
        cache.push([args, newResult]);
        return newResult;
    }

    wrapper.clearCache = () => cache.splice(0, cache.length);
    wrapper.setMaxCacheSize = (size: number) => maxCacheSize = size;
    wrapper.cache = cache;

    return wrapper;
}
