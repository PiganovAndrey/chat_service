export default interface ITokenData {
    readonly userUid: string;
    readonly role: string | null;
    readonly clientId: string;
    readonly timestampt: string;
    readonly exp?: number;
}
