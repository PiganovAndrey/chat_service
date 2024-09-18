export interface PageResponse<T> {
    result: T[];
    take: number;
    totalItems: number;
}
