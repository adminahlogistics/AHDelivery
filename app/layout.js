
import "./globals.css";

export const metadata = {
  title: "AH Parcel Delivery",
  description: "Parcel delivery platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        {children}
      </body>
    </html>
  );
}
