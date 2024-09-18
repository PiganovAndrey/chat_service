export class MessageDto {
    id: string;
    message_uid: string;
    match_uid: string;
    content: string;
    from_uid: string;
    sent_time: Date;
    update_time?: Date | null;
    isRead: boolean;
    deletedBy: string[];
    dialogId: string;
    created_at: Date;
    read_time?: Date | null;
    updated_at: Date;
    replyToMessage?: MessageDto | null;
    replyToMessageUid?: string | null;
}
