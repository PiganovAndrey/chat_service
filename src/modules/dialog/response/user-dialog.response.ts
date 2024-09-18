import { dialogs } from "@prisma/client";

export class UserDialogResponse {
    dialog: dialogs;
    to_user: Object;
    unread_count: number;
}
