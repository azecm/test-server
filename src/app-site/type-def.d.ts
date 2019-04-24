interface IUserResultQuiz {
    played: number
    min: number
}
interface IUserResultGame {
    played: number
}
interface IUserResult {
    quiz: { [s: string]: IUserResultQuiz }
    game: { [s: string]: IUserResultGame }
    //name: string
    browser: string
    ip: string
}