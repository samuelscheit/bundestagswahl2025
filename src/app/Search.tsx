"use client";

import Image from "next/image";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "../components/ui/command";
import type { ResultType } from "../../wahlkreise/scrape";
import { useState } from "react";
import { Input } from "../components/ui/input";

export function Search({ data }: { data: string[] }) {
	const [items, setItems] = useState([] as string[]);

	return (
		<div className="flex justify-center items-center grow min-h-screen">
			<div className="w-xl">
				<Command className="border shadow-2xl">
					<Input
						placeholder="Suche nach einer Gemeinde"
						onChange={(x) => {
							const { value } = x.target;

							const result = data.filter((x) => x.includes(value));
							console.log(result.length);

							setItems(result);
						}}
					/>
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
					</CommandList>
					<CommandList>
						<CommandGroup>
							{items.slice(0, 100).map((item) => (
								<CommandItem key={item} className="cursor-pointer">
									<span className="ml-2">{item}</span>
								</CommandItem>
							))}
						</CommandGroup>
						<CommandSeparator />
					</CommandList>
				</Command>
			</div>
		</div>
	);
}
