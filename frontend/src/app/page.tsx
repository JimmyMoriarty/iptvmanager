import { redirect } from 'next/navigation';

export default function Home() {
  // Since the user requested the main domain (kukey.com) to be a normal landing page
  // and iptv.kukey.com to be the admin panel, the root of the frontend app
  // should redirect to login if accessed on the admin domain.
  // In a real setup, NGINX would serve the static landing page for kukey.com
  // and route iptv.kukey.com to this Next.js app.
  redirect('/login');
}
