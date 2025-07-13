export interface IDeveloper {
    name: string;
    id: bigint;
}

export const Devs = Object.freeze({
    Prism: {
        name: "Prism",
        id: 390884143749136386n,
    },
    blankspeaker: {
        name: "blankspeaker",
        id: 433368635365392394n,
    },
    CursedAtom: {
        name: "CursedAtom",
        id: 580734913167491072n,
    },
} as const);
