import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/loginn'); // 또는 "/auth/login"
}
