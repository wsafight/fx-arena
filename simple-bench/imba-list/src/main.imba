import { buildRows, resetIds } from '../../shared/data.js'

# Imba's scheduler batches DOM writes to the next rAF tick. `imba.commit!`
# returns a promise that resolves after the commit actually runs, so each
# hook awaits it — the runner's timing window then covers the real DOM
# writes, not just the enqueue.
let rows = []
let selectedId = -1

tag app
	<self>
		<table>
			<tbody>
				for row in rows
					<tr .selected=(row.id == selectedId)>
						<td> row.id
						<td> row.label

imba.mount <app>

global.__simpleBench = {
	ready: true
	run: do(n)
		resetIds!
		selectedId = -1
		rows = buildRows(n)
		await imba.commit!
	append: do(n)
		rows = rows.concat(buildRows(n))
		await imba.commit!
	updateEvery10th: do
		let next = rows.slice!
		let i = 0
		while i < next.length
			next[i] = Object.assign({}, next[i], { label: next[i].label + ' !!!' })
			i += 10
		rows = next
		await imba.commit!
	select: do(i)
		selectedId = (rows[i] and rows[i].id) or -1
		await imba.commit!
	swap: do
		if rows.length >= 999
			let next = rows.slice!
			let tmp = next[1]
			next[1] = next[next.length - 2]
			next[next.length - 2] = tmp
			rows = next
			await imba.commit!
	remove: do(i)
		rows = rows.filter(do(_, k) k != i)
		await imba.commit!
	clear: do
		rows = []
		selectedId = -1
		await imba.commit!
	count: do rows.length
}
