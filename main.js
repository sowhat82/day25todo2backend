// load the libs
const express = require('express')
const mysql = require('mysql2/promise')
const bodyParser = require('body-parser');
const secureEnv = require('secure-env')
global.env = secureEnv({secret:'mySecretPassword'})

// SQL
const SQL_SELECT_ALL_FROM_LISTS = 'select * from lists;'
const SQL_SELECT_ALL_FROM_TASKS_WHERE_LISTID = 'select * from tasks where listID = ?;'
const SQL_SELECT_COUNT_ALL_FROM_TASKS_WHERE_LISTID = 'select count(*) from tasks where listID = ?;'

const SQL_ADD_NEW_LIST = 'insert into lists (listName, taskCount) values (?,?);'
const SQL_ADD_NEW_TASK = 'insert into tasks (taskName, listID) values (?,?);'

const SQL_DELETE_ID_FROM_LISTS = 'delete from lists where listID = ?;'
const SQL_DELETE_ID_FROM_TASKS = 'delete from tasks where taskID = ?;'
const SQL_DELETE_FROM_TASKS_WHERE_LISTID = 'delete from tasks where listID = ?;'

const SQL_UPDATE_COUNT_IN_LISTS = 'UPDATE lists SET taskCount = ? WHERE listID = ?;'
const SQL_EDIT_LIST_NAME = 'UPDATE lists SET listName = ? WHERE listID = ?;'

// configure port
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

const startApp = async (app, pool) => {
	const conn = await pool.getConnection()
	try {
		console.info('Pinging database...')
		await conn.ping()
		app.listen(PORT, () => {
			console.info(`Application started on port ${PORT} at ${new Date()}`)
		})
	} catch(e) {
		console.error('Cannot ping database', e)
	} finally {
		conn.release()
	}
}

// create connection pool
const pool = mysql.createPool({
	host: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT) || 3306,
	database: 'todo',
	user: global.env.DB_USER || process.env.DB_USER,
	password: global.env.DB_PASSWORD || process.env.DB_PASSWORD,
	connectionLimit: 4
})

// create an instance of the application
const app = express()
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

// start the app
startApp(app, pool)

app.get('/lists', async (req, resp) => {
	const conn = await pool.getConnection()
	try {
		const [ result, _ ] = await conn.query(SQL_SELECT_ALL_FROM_LISTS)

		resp.status(200)
		resp.type('application/json').send(result)
	} catch(e) {
		console.error('ERROR: ', e)
		resp.status(500)
		resp.end()
	} finally {
		conn.release()
	}
})

app.get('/tasks/:listID', async (req, resp) => {
	const conn = await pool.getConnection()
	try {
		const [ result, _ ] = await conn.query(SQL_SELECT_ALL_FROM_TASKS_WHERE_LISTID, [req.params.listID])

		resp.status(200)
		resp.type('application/json').send(result)
	} catch(e) {
		console.error('ERROR: ', e)
		resp.status(500)
		resp.end()
	} finally {
		conn.release()
	}
})

app.post('/addTask', async (req, resp) => {

    const taskName = req.body.taskName;
    const listID = req.body.listID;

	const conn = await pool.getConnection()
	try {

		await conn.beginTransaction() // to prevent only one DB from being updated

        await conn.query(
        	SQL_ADD_NEW_TASK, [taskName, listID],
		)

		// update tasks count in list
		const [ count, _2 ] = await conn.query(SQL_SELECT_COUNT_ALL_FROM_TASKS_WHERE_LISTID, [listID])
		await conn.query(SQL_UPDATE_COUNT_IN_LISTS, [count[0]['count(*)'], listID])


		await conn.commit()

		resp.status(200)
		// resp.format({
		// 	html: () => { resp.send('Thank you'); },
		// 	json: () => { resp.json({status: 'ok'});}

		// })
		resp.json()

	} catch(e) {
		conn.rollback()
		resp.status(500).send(e)
		resp.end()
	} finally {
		conn.release()
	}
});

app.post('/addList', async (req, resp) => {

    const listName = req.body.listName;

	const conn = await pool.getConnection()
	try {

		await conn.beginTransaction() // to prevent only one DB from being updated

        await conn.query(
            SQL_ADD_NEW_LIST, [listName, 0],
		)

		await conn.commit()

		resp.status(200)
		// resp.format({
		// 	html: () => { resp.send('Thank you'); },
		// 	json: () => { resp.json({status: 'ok'});}

		// })
		resp.json()

	} catch(e) {
		conn.rollback()
		resp.status(500).send(e)
		resp.end()
	} finally {
		conn.release()
	}
});

app.post('/deleteList', async (req, resp) => {

	const listID = req.body.listID;

	const conn = await pool.getConnection()
	try {

		await conn.beginTransaction() // to prevent one table from being updated and not the other

		await conn.query(SQL_DELETE_FROM_TASKS_WHERE_LISTID, [listID])
		await conn.query(SQL_DELETE_ID_FROM_LISTS, [listID])

		await conn.commit()

		resp.status(200)
		resp.type('applcation/json')
		resp.json()
        
	} catch(e) {
		conn.rollback()

		console.error('ERROR: ', e)
		resp.status(500)
		resp.end()
	} finally {
		conn.release()
	}
})

app.post('/deleteTask', async (req, resp) => {

	const taskID = req.body.taskID;
	const listID = req.body.listID;

	const conn = await pool.getConnection()
	try {

		await conn.beginTransaction() // to prevent one table from being updated and not the other

		await conn.query(SQL_DELETE_ID_FROM_TASKS, [taskID])

		// update tasks count in list
		const [ count, _2 ] = await conn.query(SQL_SELECT_COUNT_ALL_FROM_TASKS_WHERE_LISTID, [listID])
		
		conn.query(SQL_UPDATE_COUNT_IN_LISTS, [count[0]['count(*)'], listID])

		conn.commit()

		resp.status(200)
		resp.type('applcation/json')
		resp.json()
        
	} catch(e) {
		conn.rollback()

		console.error('ERROR: ', e)
		resp.status(500)
		resp.end()
	} finally {
		conn.release()
	}
})

app.post('/editListName', async (req, resp) => {

    const listName = req.body.listName;
    const listID = req.body.listID;

	const conn = await pool.getConnection()
	try {

		await conn.beginTransaction() // to prevent only one DB from being updated

        await conn.query(
            SQL_EDIT_LIST_NAME, [listName, listID],
		)
		await conn.commit()

		resp.status(200)
		resp.json()

	} catch(e) {
		conn.rollback()
		resp.status(500).send(e)
		resp.end()
	} finally {
		conn.release()
	}
});

