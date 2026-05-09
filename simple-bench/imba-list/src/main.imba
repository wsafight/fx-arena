import { buildRows, resetIds } from '../../shared/data.js'

# Selection by id, not index — in-place-shifting ops don't force every
# row template to re-evaluate its .selected binding.
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
		imba.commit!
	append: do(n)
		rows = rows.concat(buildRows(n))
		imba.commit!
	updateEvery10th: do
		let next = rows.slice!
		let i = 0
		while i < next.length
			next[i] = Object.assign({}, next[i], { label: next[i].label + ' !!!' })
			i += 10
		rows = next
		imba.commit!
	select: do(i)
		selectedId = (rows[i] and rows[i].id) or -1
		imba.commit!
	swap: do
		if rows.length >= 999
			let next = rows.slice!
			let tmp = next[1]
			next[1] = next[next.length - 2]
			next[next.length - 2] = tmp
			rows = next
			imba.commit!
	remove: do(i)
		rows = rows.filter(do(_, k) k != i)
		imba.commit!
	clear: do
		rows = []
		selectedId = -1
		imba.commit!
	count: do rows.length
}
