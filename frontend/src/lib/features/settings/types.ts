export interface Settings {
  id: number;
  kostName: string | null;
  bankAccountInfo: string | null;
  qrisImageUrl: string | null;
  botWaStatus: boolean;
  defaultBillAmount: number | null;
  reminderTime: string | null;
  reminderFrequency: string | null;
  reminderWeekdays: string | null;
  reminderDates: string | null;
  billCreationTime: string | null;
  billCreationFrequency: string | null;
  billCreationWeekdays: string | null;
  billCreationDates: string | null;
  createdAt: string;
  updatedAt: string;
}
