import { redirect } from "next/navigation";

export default function IndexPage() {
  redirect("/login");  // 또는 "/auth/login"
}
