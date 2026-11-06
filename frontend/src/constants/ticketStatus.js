/**
 * Sebuah array konstan yang mendefinisikan status tiket yang memungkinkan di seluruh aplikasi.
 * Digunakan untuk memastikan konsistensi dalam filter, tampilan, dan logika.
 * @type {Array<{key: string, label: string}>}
 */
export const TICKET_STATUSES = [
  { key: 'open', label: 'Open' },
  { key: 'pending', label: 'Pending' },
  { key: 'closed', label: 'Closed' },
];
