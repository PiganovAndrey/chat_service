import { dialogs } from "@prisma/client";

export class DialogResponse {
    dialog: dialogs;
    toUser: Object;
};
