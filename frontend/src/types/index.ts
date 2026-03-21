import type { components } from './api';

type VolumeNode = components['schemas']['VolumeNode'];
type ActNode = components['schemas']['ActNode'];
type NoteNode = components['schemas']['NoteNode'];

export type TreeNodeType = VolumeNode | ActNode | NoteNode;

export type { VolumeNode, ActNode, NoteNode };
