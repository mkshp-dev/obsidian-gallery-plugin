export interface ImmichAsset {
    id: string;
    originalFileName?: string;
    [key: string]: unknown;
}

export interface ImmichAlbum {
    id: string;
    albumName?: string;
    assets?: ImmichAsset[];
    [key: string]: unknown;
}

export interface ImmichTag {
    id: string;
    value: string;
    [key: string]: unknown;
}

export interface ImmichShareResponse {
    assets?: ImmichAsset[];
    asset?: ImmichAsset;
    album?: ImmichAlbum;
    [key: string]: unknown;
}

export interface ImmichPerson {
    id: string;
    name: string;
    [key: string]: unknown;
}
