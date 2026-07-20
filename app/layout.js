export const metadata = {
  title: "Walmart → SHV Logistics Load Builder",
  description:
    "Fetch Walmart freight tenders, sanitize them per SHV rules, and push them into the SHV Logistics TMS.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
