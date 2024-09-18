import { dialogs } from "@prisma/client";

export class CreateDialogResponse {
    message: string;
    dialog: dialogs
}
