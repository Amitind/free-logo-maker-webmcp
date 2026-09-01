import { HexColorPicker } from 'react-colorful';
import { Input } from '@/components/ui/input';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

interface ColorPickerButtonProps {
	color: string;
	onChange: (color: string) => void;
	label: string;
	showInput?: boolean;
}

export function ColorPickerButton({
	color,
	onChange,
	label,
	showInput = true,
}: ColorPickerButtonProps) {
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		// Validate hex color
		if (/^#[0-9A-F]{6}$/i.test(val) || val.length <= 7) {
			onChange(val);
		}
	};

	return (
		<Popover>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<PopoverTrigger asChild>
							<button
								type='button'
								className='size-9 rounded border-2 border-border hover:border-primary transition-colors flex-shrink-0'
								style={{ backgroundColor: color }}
								aria-label={label}
								title={color}
							/>
						</PopoverTrigger>
					</TooltipTrigger>
					<TooltipContent side='left'>
						<p className='text-xs'>{label}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<PopoverContent className='w-fit p-3' side='left'>
				<div className='space-y-2 w-[200px]'>
					<HexColorPicker
						color={color}
						onChange={onChange}
						style={{ width: '200px', height: '150px' }}
					/>
					{showInput && (
						<Input
							value={color}
							onChange={handleInputChange}
							className='font-mono text-xs h-8 mt-1 w-full'
							placeholder='#000000'
							maxLength={7}
							title='Hex color value'
						/>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
