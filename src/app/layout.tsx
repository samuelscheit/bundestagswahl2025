import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "NRW 2025",
	description: "Visualisierung der NRW Kommunalwahl 2025",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased w-screen min-h-screen`}>
				{children}
				<script defer data-domain="nrw25.samuelscheit.com" src="https://p.samuelscheit.com/js/script.js"></script>
			</body>
		</html>
	);
}
