import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/login'); // 또는 "/auth/login"
}
