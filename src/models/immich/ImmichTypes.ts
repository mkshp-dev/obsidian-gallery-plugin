export interface ImmichAsset {
    id: string;
    originalFileName?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export interface ImmichAlbum {
    id: string;
    albumName?: string;
    assets?: ImmichAsset[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export interface ImmichTag {
    id: string;
    value: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export interface ImmichShareResponse {
    assets?: ImmichAsset[];
    asset?: ImmichAsset;
    album?: ImmichAlbum;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}
