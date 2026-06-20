/** Minimal typed event emitter used to feed React from the imperative controller. */
type Listener<T> = (payload: T) => void;

export class Emitter<Events extends Record<string, unknown>> {
    private listeners: {[K in keyof Events]?: Set<Listener<Events[K]>>} = {};

    on<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void {
        const set = (this.listeners[event] ??= new Set());
        set.add(fn);
        return () => {
            this.listeners[event]?.delete(fn);
        };
    }

    emit<K extends keyof Events>(event: K, payload: Events[K]): void {
        this.listeners[event]?.forEach(fn => fn(payload));
    }
}
