export const metadata = {
  title: 'Futureline',
  description: 'Plan and visualize the next decades at a glance.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
