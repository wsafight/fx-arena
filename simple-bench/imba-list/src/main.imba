import { buildRows, resetIds } from '../../shared/data.js'

let rows = []
let selected = -1

tag app
	<self>
		<table>
			<tbody>
				for row, i in rows
					<tr .selected=(i == selected)>
						<td> row.id
						<td> row.label

imba.mount <app>

global.__simpleBench = {
	ready: true
	run: do(n)
		resetIds!
		selected = -1
		rows = buildRows(n)
		imba.commit!
	append: do(n)
		rows = rows.concat(buildRows(n))
		imba.commit!
	updateEvery10th: do
		let i = 0
		while i < rows.length
			rows[i] = Object.assign({}, rows[i], { label: rows[i].label + ' !!!' })
			i += 10
		imba.commit!
	select: do(i)
		selected = i
		imba.commit!
	swap: do
		if rows.length >= 999
			let tmp = rows[1]
			rows[1] = rows[rows.length - 2]
			rows[rows.length - 2] = tmp
			imba.commit!
	remove: do(i)
		rows = rows.filter(do(_, k) k != i)
		imba.commit!
	clear: do
		rows = []
		selected = -1
		imba.commit!
	count: do rows.length
}
