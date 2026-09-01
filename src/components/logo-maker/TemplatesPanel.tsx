import { LazySvg } from '@/components/common/LazySvg';
import { iconUrl } from '@/lib/logo-icons';
import { splitCss } from '@/lib/svg-utils';
import { type LogoTemplate, logoTemplates } from './templates';

interface TemplatesPanelProps {
	onSelectTemplate: (template: LogoTemplate) => void;
}

const SHAPE_RADIUS: Record<string, string> = {
	circle: 'rounded-full',
	squircle: 'rounded-[28%]',
	rectangle: 'rounded-xl',
};

function tintedIconUrl(iconName: string, fill: string): string {
	return `${iconUrl(iconName)}?color=${encodeURIComponent(fill)}`;
}

function getTemplateBgStyle(
	bg: LogoTemplate['background'],
): React.CSSProperties {
	if (bg.type === 'solid') {
		return { backgroundColor: bg.solidColor };
	}
	if (bg.type === 'split') {
		return {
			backgroundImage: splitCss(bg),
		};
	}
	if (bg.type === 'radial') {
		const colors =
			bg.gradientColors.length > 0
				? bg.gradientColors
				: [bg.solidColor, bg.solidColor];
		return {
			backgroundImage: `radial-gradient(circle at 50% 50%, ${colors.join(', ')})`,
		};
	}
	const colors =
		bg.gradientColors.length > 0
			? bg.gradientColors
			: [bg.solidColor, bg.solidColor];
	const direction = bg.gradientDirection || 'to bottom right';
	return {
		backgroundImage: `linear-gradient(${direction}, ${colors.join(', ')})`,
	};
}

export function TemplatesPanel({ onSelectTemplate }: TemplatesPanelProps) {
	return (
		<div className='flex flex-col flex-1 min-h-0'>
			<div className='p-4 border-b'>
				<h2 className='font-semibold text-sm'>Templates</h2>
				<p className='text-xs text-muted-foreground mt-0.5'>
					Start from a ready-made logo, then customize it
				</p>
			</div>
			<div className='flex-1 overflow-y-auto [scrollbar-gutter:stable]'>
				<div className='p-4 pb-8 grid grid-cols-2 gap-4'>
					{logoTemplates.map((template) => {
						const primaryLayer = template.layers[0];
						const radiusClass =
							SHAPE_RADIUS[template.background.shape] ?? 'rounded-xl';
						const bgStyle = getTemplateBgStyle(template.background);

						return (
							<button
								type='button'
								key={template.id}
								className='flex flex-col items-center gap-2 group text-left'
								onClick={() => onSelectTemplate(template)}
								data-track-click='logo_template_select'
								data-track-params={JSON.stringify({
									template_id: template.id,
									template_name: template.name,
								})}
							>
								<div className='w-full aspect-square rounded-2xl border bg-muted/20 p-2 overflow-hidden relative group-hover:border-primary/50 group-hover:shadow-md transition-all flex items-center justify-center'>
									<div
										className={`relative w-full h-full p-[18%] flex items-center justify-center shadow-xs overflow-hidden ${radiusClass}`}
										style={bgStyle}
									>
										{template.background.pattern &&
											template.background.pattern !== 'none' && (
												<div
													className='absolute inset-0 pointer-events-none'
													style={{
														backgroundImage:
															template.background.pattern === 'grid'
																? `linear-gradient(${template.background.patternColor} 1px, transparent 1px), linear-gradient(90deg, ${template.background.patternColor} 1px, transparent 1px)`
																: `radial-gradient(${template.background.patternColor} 1.5px, transparent 1.5px)`,
														backgroundSize: '16px 16px',
														opacity: template.background.patternOpacity || 0.15,
													}}
												/>
											)}

										{primaryLayer && (
											<div
												className='relative z-10 w-full h-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105'
												style={{
													transform: `rotate(${primaryLayer.rotation}deg)`,
													opacity: primaryLayer.opacity,
												}}
											>
												<LazySvg
													alt={primaryLayer.iconName}
													url={tintedIconUrl(
														primaryLayer.iconName,
														primaryLayer.fill !== 'none'
															? primaryLayer.fill
															: primaryLayer.stroke !== 'none'
																? primaryLayer.stroke
																: '#ffffff',
													)}
													className='w-full h-full object-contain'
												/>
											</div>
										)}
									</div>
								</div>
								<span className='text-xs font-medium truncate w-full text-foreground/90 group-hover:text-primary transition-colors'>
									{template.name}
								</span>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
