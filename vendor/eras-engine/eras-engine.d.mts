type Nullable<T> = T | null | undefined
declare function KtSingleton<T>(): T & (abstract new() => any);
export declare abstract class EngineApi {
    static readonly getInstance: () => typeof EngineApi.$metadata$.type;
    private constructor();
}
export declare namespace EngineApi {
    /** @deprecated $metadata$ is used for internal purposes, please don't use it in your code, because it can be removed at any moment */
    namespace $metadata$ {
        abstract class type extends KtSingleton<constructor>() {
            private constructor();
        }
        abstract class constructor {
            get VERSION(): string;
            shuffledOrder(seed: string, count: number): Array<number>;
            installCards(bundle: string): number;
            installBotResources(json: string): number;
            cardSummary(text: string): string;
            private constructor();
        }
    }
}
export declare class LocalMatch {
    constructor(config: string);
    get roomId(): string;
    get userId(): string;
    lastError(): Nullable<string>;
    send(action: string): Array<string>;
    step(): Nullable<Array<string>>;
    playBot(): Array<string>;
    botPauseMs(): number;
    status(): string;
    result(): string;
}
export declare namespace LocalMatch {
    /** @deprecated $metadata$ is used for internal purposes, please don't use it in your code, because it can be removed at any moment */
    namespace $metadata$ {
        const constructor: abstract new () => LocalMatch;
    }
    abstract class Companion extends KtSingleton<Companion.$metadata$.constructor>() {
        private constructor();
    }
    namespace Companion {
        /** @deprecated $metadata$ is used for internal purposes, please don't use it in your code, because it can be removed at any moment */
        namespace $metadata$ {
            abstract class constructor {
                get DEFAULT_ROOM(): string;
                get DEFAULT_USER(): string;
                get DEFAULT_TICK_NANOS(): number;
                get MAX_BOT_MOVES(): number;
                private constructor();
            }
        }
    }
}