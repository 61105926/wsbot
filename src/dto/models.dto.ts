/**
 * Interfaces para modelos de datos
 */

export interface User {
  fullName: string;
  empID: string;
  phone: string;
  linkURL: string;
}

export interface UserWithRegional extends User {
  regional: string;
}

export interface ResponseAPI {
  data: DataAPI;
}

export interface DataAPI {
  fullName: string;
  empID: string;
  phone: string;
  jwt: string;
  regional?: string;
}

export interface PayslipMessageData {
  user: User;
  month: string;
  fileName: string;
  pdfPath: string;
  message: string;
}

export interface RegionalMessageData {
  user: UserWithRegional;
  messages: string[];
  filePath?: string;
}
