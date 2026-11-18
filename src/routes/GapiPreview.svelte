<script lang="ts">
	import { ASIA_HO_CHI_MINH, type GapiEvent } from '$lib/core/mod';
	import { eventColor } from '$lib/colors';

	export let events: GapiEvent[];
	const localTime = new Intl.DateTimeFormat('en-GB', {
		timeZone: ASIA_HO_CHI_MINH,
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	});
	const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	function localParts(timestamp: string) {
		const parts = localTime.formatToParts(new Date(timestamp));
		const part = (key: string) => parts.find(({ type }) => type === key)?.value ?? '';
		return { day: days.indexOf(part('weekday')), hour: +part('hour') + +part('minute') / 60 };
	}

	$: blocks = events.map((event) => {
		const start = localParts(event.start.dateTime);
		const end = localParts(event.end.dateTime);
		return { event, day: start.day, start: Math.floor(start.hour), end: Math.ceil(end.hour) };
	});
	$: columns = Math.max(5, ...blocks.map(({ day }) => day + 1));
	$: firstHour = Math.min(6, ...blocks.map(({ start }) => start));
	$: rows = Math.max(18, ...blocks.map(({ end }) => end)) - firstHour;
</script>

<div
	class="mt-3 grid gap-x-1"
	aria-label="Thời khóa biểu theo giờ Việt Nam"
	style:grid-template-columns="repeat({columns}, minmax(0, 1fr))"
	style:grid-template-rows="repeat({rows}, minmax(0, 1fr))"
>
	{#each Array(rows) as _, row}
		<div
			aria-hidden="true"
			class="-mx-2 {row % 2 === 1
				? 'bg-transparent'
				: 'border-b-[1.5px] border-dotted border-slate-200 bg-slate-100'}"
			style:grid-row="{row + 1} / span 1"
			style:grid-column="1 / span {columns}"
		></div>
	{/each}
	{#each blocks as { event, day, start, end }}
		<div
			class="my-0.5 rounded px-1 py-0.5 text-xs italic text-slate-50 shadow-md"
			aria-label={event.summary}
			title={event.summary +
				' · ' +
				localTime.format(new Date(event.start.dateTime)) +
				' – ' +
				localTime.format(new Date(event.end.dateTime)) +
				' · ' +
				event.location}
			style:background-color={eventColor(event)}
			style:grid-column="{day + 1} / span 1"
			style:grid-row="{start - firstHour + 1} / {end - firstHour + 1}"
		>
			<p class="line-clamp-3">{event.summary}</p>
		</div>
	{/each}
</div>
