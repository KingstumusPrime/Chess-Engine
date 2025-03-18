const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth
canvas.height = window.innerHeight

boardSize = 8;
squareSize = 65;


// as binary we can & 7 to get the piece type and >> 3 to get the piece color 1 or two
const None = 0;
const King = 1;
const Queen = 2;
const Bishop = 3;
const Knight = 4;
const Rook = 5;
const Pawn = 6;

const pawnVal = 100;
const knightVal = 300;
const bishopVal = 300;
const rookVal = 500;
const queenVal = 900;

const White = 8;
const Black = 16;

// MOVE FLAGS:
// first 6 bits is pos
const lCastle = 0b010;
const rCastle = 0b001;
const en = 0b0100;
const dub = 0b0011; // last pawn to double jump

// promotion flags
const promoteQ = 0b0101
const promoteK = 0b0110
const promoteB = 0b1100
const promoteR = 0b1000

const quite = 0b0000;
const player = "Player";
const enemy = "AI"; // "Player"

let searchCount = 0;
// example move 
// 0b0110000000 : Castled left queen side

let selectedPiece = {piece: None, pos: -1};
let distToEdge = []; // stores all the distances to the edge from each square
let offsets = [-8, 1, 8, -1, -9, -7, 7, 9]; // stores the offsets starting with north, east, south, and west, then the diagonals.
let board = new Array(64);
let pieceToMove = 1; // color of the current piece
let opponent = 2; // color of the opponent piece
let castleFlags = ["-", "-", "-", "-"]; // if an O they have castled on that side first is white left then white right then black left then black right
let wPassant = -1; // the row that the last white pawn double jumped
let bPassant = -1; // the row that the last black pawn double jumped


if(Object.seal) {
    // fill array with some value because
    // empty slots can not be changed after calling Object.seal
    board.fill(0);
  
    Object.seal(board);
    // now a is a fixed-size array with mutable entries
  }

function makeDists(){
    for(let i = 0; i < boardSize; i ++){
        for(let j = 0; j < boardSize; j++){
            const numSouth = boardSize - i;
            const numEast = boardSize - j;
            const numNorth = i + 1;
            const numWest = j + 1;

            distToEdge[i * boardSize + j] = [numNorth, numEast, numSouth, numWest, Math.min(numWest, numNorth), Math.min(numNorth, numEast), Math.min(numWest, numSouth), Math.min(numEast, numSouth)];
        }
    }
}

function countMoves(depth){
    if(depth == 0){
        return 1;
    }
    const moves = [].concat(...genLegalMoves());
    let numPositions = 0;
    moves.forEach(move => {
        const ob = [...board];
        const oldSide = pieceToMove;
        const woPass = wPassant;
        const boPass = bPassant; 
        const castle = [...castleFlags];
        makeMove(move);
        const r = countMoves(depth - 1);
        if(depth == 6){
            const start = asPos(move.start);
            const end = asPos(move.end)
            console.log(start.row + start.col + end.row + end.col + "   " + r);
        }

        numPositions += r

        castleFlags = [...castle];
        pieceToMove = oldSide;
        bPassant = boPass;
        wPassant = woPass;
        if(pieceToMove == 1){
            opponent = 2;
        }else{
            opponent = 1;
        }
        board = [...ob];
    });
    return numPositions;
}

function evaluate(){
    const mat = countMaterial();
    const isW = pieceToMove == 1 ? -1 : 1;
    return (mat.white - mat.black) * isW;
}

function getPieceValue(p){
    if(p == Knight) return knightVal
    if(p == Rook) return rookVal
    if(p == Queen) return queenVal
    if(p == Bishop) return bishopVal
    if(p == Pawn) return pawnVal
    return 0;
}

function sortMoves(moves){
    let res = []
    moves.forEach(move => {
        let scoreGuess = 0;
        const cScore = getPieceValue(move.capped & 7);
        const pScore = getPieceValue( (move.flags & 31) & 7);
        // check if the capped piece is better
        if(cScore != 0){
            scoreGuess = 10 * pScore - cScore;
        }
        res.push({move: move, score: scoreGuess});
    })
    // sort by score
    return res.sort((a, b) => a.score - b.score);
}

function search(depth, alpha, beta, isMax){    
    if(depth == 0){
        return evaluate();
    }
    
    const moves = sortMoves([].concat(...genLegalMoves()));

    if(moves.length == 0){
        return -Infinity;
    }

    if(isMax){
        let score = -Infinity
        moves.forEach(move => {
            searchCount += 1;

            const ob = [...board];
            const oldSide = pieceToMove;
            const woPass = wPassant;
            const boPass = bPassant; 
            const castle = [...castleFlags];
            makeMove(move.move);
            castleFlags = [...castle];
            pieceToMove = oldSide;
            bPassant = boPass;
            wPassant = woPass;
            if(pieceToMove == 1){
                opponent = 2;
            }else{
                opponent = 1;
            }
            board = [...ob];

            score = Math.max(score, search(depth - 1, beta, alpha, false));
            
            if (score > beta){
                return
            }
            alpha = Math.max(alpha, score);

        })
        return score
    }else{
        let score = Infinity
        moves.forEach(move => {
            searchCount += 1;

            const ob = [...board];
            const oldSide = pieceToMove;
            const woPass = wPassant;
            const boPass = bPassant; 
            const castle = [...castleFlags];
            makeMove(move.move);
            castleFlags = [...castle];
            pieceToMove = oldSide;
            bPassant = boPass;
            wPassant = woPass;
            if(pieceToMove == 1){
                opponent = 2;
            }else{
                opponent = 1;
            }
            board = [...ob];

            score = Math.min(score, search(depth - 1, beta, alpha, true));
            
            if (score < alpha){
                return
            }
            beta = Math.min(beta, score);

        })
        return score
    }

}


function bestMove(depth=0, alpha=-Infinity, beta=Infinity){
    searchCount = 0;
    let bestMove = {start: 0, end:0, flags: 0, capped: 0};
    let bestSearch = -Infinity;
    let moves = sortMoves([].concat(...genLegalMoves()));
    moves.forEach(move => {
        const ob = [...board];
        const oldSide = pieceToMove;
        const woPass = wPassant;
        const boPass = bPassant; 
        const castle = [...castleFlags];
        makeMove(move.move);
        const v = search(2, alpha, beta, true);
        console.log(v);
        if(v > bestSearch){
            bestSearch = v;
            bestMove = move;
        }
        // undo the move
        castleFlags = [...castle];
        pieceToMove = oldSide;
        bPassant = boPass;
        wPassant = woPass;
        if(pieceToMove == 1){
            opponent = 2;
        }else{
            opponent = 1;
        }
        board = [...ob];
    })
    console.log('bm:')
    console.log(bestMove);
    console.log("SEARCHED: " + searchCount);
    return bestMove;
}

function countMaterial(){
    let w = 0;
    let b = 0;
    board.forEach(square => {
        if(square != 0 && (square >> 3 == 1)){
            const p = square & 7;
            if(p == Knight) w += knightVal
            if(p == Pawn) w += pawnVal
            if(p == Rook) w += rookVal
            if(p == Bishop) w += bishopVal
            if(p == Queen) w += queenVal
        }else if(square != 0 && (square >> 3 == 2)){
            const p = square & 7;
            if(p == Knight) b += knightVal
            if(p == Pawn) b += pawnVal
            if(p == Rook) b += rookVal
            if(p == Bishop) b += bishopVal
            if(p == Queen) b += queenVal
        }
    })
    return {white: w, black: b};
}

// replace function
String.prototype.replaceAt = function (index, char) {
    let a = this.split("");
    a[index] = char;
    return a.join("");
  }


function drawBoard(moves){
    for(let i = 0; i < boardSize; i++){
        for(let j = 0; j < boardSize; j++){
            if((i + j)% 2 != 0){
                ctx.fillStyle = "#769656";
            }else{
                ctx.fillStyle = "#eeeed2";
            }
            ctx.fillRect(10 + i * squareSize, 10 + j * squareSize, squareSize, squareSize);
            if(board[(boardSize * j) + i] > 0){
                const p = board[(boardSize * j) + i];
                ctx.drawImage(pieces, 333 * ((p&7) - 1), 333 * ((p >> 3) - 1), 333, 333, 10 + i * squareSize, 10 + j * squareSize, squareSize, squareSize);
            }
            if((boardSize * j) + i == selectedPiece.pos){
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = "#FE0000"
                ctx.fillRect(10 + i * squareSize, 10 + j * squareSize, squareSize, squareSize);
                ctx.globalAlpha = 1.0;
            }
        }
    }
    // draw selected moves
    if(selectedPiece.pos == -1){
        return;
    }
    moves[selectedPiece.pos].forEach((square) => {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#FE0000"
        ctx.fillRect(10 + (square.end%8) * squareSize, 10 + Math.floor(square.end/8) * squareSize, squareSize, squareSize);
        ctx.globalAlpha = 1.0;
    })
}

function genCastles(start){
    let moves = [];
    let lc = (castleFlags[2 * (pieceToMove - 1)]) != "O";
    // check left
    for(let i = 1; i <= 3; i++){
        if(board[start - i] != 0){
            lc = false;
            break;
        }
    }
    if( board[start - 4] != (pieceToMove << 3) | Rook){
        lc = false;
    }
    if(lc){
        moves.push({start: start, end: start - 2, flags: (lCastle << 6) + (pieceToMove << 3 | King), capped: 0});
    }
    // check right
    for(let i = 1; i <= 2; i++){
        if(board[start + i] != 0 || castleFlags[ 1  + 2 * ( pieceToMove - 1)] == "O"){
            return moves;
        }
    }
    if( board[start + 3] == (pieceToMove << 3) | Rook){
        moves.push({start: start, end: start + 2, flags: (rCastle << 6) + (pieceToMove << 3 | King), capped: 0});
    }
    return moves;
}

function loadFEN(note){
    const Map = {"q": Queen, "k": King, "n": Knight, "p": Pawn, "b": Bishop, "r": Rook};
    let file = 0;
    let rank = 0;
    let b = note.split(" ")[0];
    for(char of b){
        if(!isNaN(parseInt(char))){
            file += parseInt(char);
        }
        else if(char == "/"){
            rank += 1;
            file = 0;
        }else{
            if(char.toUpperCase() == char){
                board[boardSize * rank + file] = White| Map[char.toLowerCase()];
            }else{
                board[boardSize * rank + file] = Black| Map[char];
            }
            file += 1;
        }
    } 

}

function main(){
    makeDists();
    updateBoard();
    if(player == "AI"){
        AiMove();
    }
    // makeDists();
    // alert(countMoves(2));
}

function changeSides(){
    if(pieceToMove == 1){
        pieceToMove = 2;
        opponent = 1;
    }else{
        pieceToMove = 1;
        opponent = 2;
    }
}

// return row, col of pos
function asPos(p){
    const letters = ["a", "b", "c", "d", "e", "f", "g", "h"];
    return {row: letters[p%8], col: 8 - Math.floor(p/8)};
}

document.addEventListener("click", (e) => {
    if(pieceToMove != opponent){
        const pos = getMousePos(canvas, e);
        if(selectedPiece.piece == None){
            selectedPiece.piece = board[ Math.floor((pos.y)/64) * boardSize + Math.floor((pos.x)/64)];
            selectedPiece.pos = Math.floor((pos.y)/64) * boardSize + Math.floor((pos.x)/64);
            updateBoard(genLegalMoves())
        }else{
            const move = getMove(selectedPiece.pos, Math.floor((pos.y)/64) * boardSize + Math.floor((pos.x)/64));
            if(move == None){
                selectedPiece = {piece: None, pos: -1};
                updateBoard();
                return;
            }
            makeMove(move);
            selectedPiece = {piece: None, pos: -1};
            updateBoard();
            //alert(evaluate());
            evaluate();
            if(enemy == "AI"){
                setTimeout(function() {
                    //your code to be executed after 1 second
                    AiMove();
                  }, 1000);

            }

        }
    }
})

function AiMove(){
    const move = bestMove();
    makeMove(move.move);
    updateBoard();

    if(player == "AI"){
        setTimeout(function() {
            AiMove();
        }, 500);
    }
}

// dir is either left or right
function checkCastle(move){
    const flags = move.flags >> 6;
    let can = true; // can we castle
    if(flags == lCastle){
        can = isLegal({start: move.start, end: move.start, flags: (quite << 6) + (pieceToMove << 3 | King)}); // check if the king is in check
        if(!can){return false;}
        can = isLegal({start: move.start, end: move.start + offsets[3], flags: (quite << 6) + (pieceToMove << 3 | King)}); // check if next part is in check
        if(!can){return false;}
        can = isLegal({start: move.start, end: move.start + offsets[3] * 2, flags: (quite << 6) + (pieceToMove << 3 | King)}); // check if we end in check
    }
    if(flags == rCastle){
        can = isLegal({start: move.start, end: move.start, flags: (quite << 6) + (pieceToMove << 3 | King)}); // check if the king is in check
        if(!can){return false;}
        can = isLegal({start: move.start, end: move.start + offsets[1], flags: (quite << 6) + (pieceToMove << 3 | King)}); // check if next part is in check
        if(!can){return false;}
        can = isLegal({start: move.start, end: move.start + offsets[1] * 2, flags: (quite << 6) + (pieceToMove << 3 | King)}); // check if we end in check
    }
    return can;
}

function isLegal(move){
    const ob = [...board];
    const oldSide = pieceToMove;
    const woPass = wPassant;
    const boPass = bPassant; 
    const castle = [...castleFlags];
    let flag = true;
    makeMove(move)
    const responses = genMoves();
    responses.forEach(s => {
        s.forEach(m => {
            if( (board[m.end] & 7) == King){
                flag = false;
            }
        })
    });
    castleFlags = [...castle];
    pieceToMove = oldSide;
    bPassant = boPass;
    wPassant = woPass;
    if(pieceToMove == 1){
        opponent = 2;
    }else{
        opponent = 1;
    }
    board = [...ob];
    return flag;
}

function genLegalMoves(){
    const moves = genMoves();
    const res = []
    let moveCount = 0; // how many moves they have
    moves.forEach((square, index) => {
        res[index] = []; 
        square.forEach(move => {
            if( (move.flags >> 6) == lCastle || (move.flags >> 6) == rCastle){
                if(checkCastle(move)){
                    moveCount += 1;
                    res[index].push(move);
                }
            }else if(isLegal(move)){
                moveCount += 1;
                res[index].push(move);
            }
        })
    })
    return res;
}

function getMove(start, end){
    const m = genLegalMoves();
    let v = None;
    m[start].forEach((move) => {
        if(move.end == end){
            v = move;
            return;
        }
    });
    return v;
}


function makeMove(move){
    wPassant = -1;
    bPassant = -1;
    const piece = move.flags & 31;
    const flag = move.flags >> 6;
    const start = move.start;
    const end = move.end;
    const color = piece >> 3;
    // castles
    if(flag == lCastle){
        board[start] = 0; 
        board[end] = piece;
        board[end + 1] = board[start - 4]; 
        board[start - 4] = 0;
        changeSides();
        return;
    }
    if(flag == rCastle){
        board[start] = 0; 
        board[end] = piece;
        board[end - 1] = board[start + 3]; 
        board[start + 3] = 0;
        changeSides();
        return;
    }
    // disable castles
    if(castleFlags[2 * (color - 1)] == "-" || castleFlags[1 + 2 * (color - 1)] == "-"){
        if( (piece & 7) == King){
            castleFlags[ (2 * (color - 1)) ] = 'O';
            castleFlags[ 1 + 2 * (color - 1)] = "O";
        }
        if((piece & 7) == Rook && (start%8) == 0){
            castleFlags[2 * (color - 1)] = "O";
        }else if((piece & 7) == Rook){
            castleFlags[ 1 + 2 * (color - 1)] = "O";
        }
    }
    // can we en passant next turn
    if(flag == dub){
        if((color << 3) == White){
            wPassant = start%8;
        }else{
            bPassant = start%8;
        }
    }
    // when we en passant
    if(flag == en){
        board[start] = 0; 
        board[end] = piece; 
        const back = pieceToMove == 2? offsets[0] : offsets[2]; // get the back offset for whit and black 
        board[end + back] = 0;
        changeSides();
        return;
    }
    // where we make the move:
    // White pawn promotion
    if(flag == promoteQ){
        board[start] = 0; 
        board[end] = (pieceToMove << 3) | Queen; 
        changeSides();
        return;
    }
    if(flag == promoteR){
        board[start] = 0; 
        board[end] = (pieceToMove << 3) | Rook; 
        changeSides();
        return; 
    }
    if(flag == promoteK){
        board[start] = 0; 
        board[end] = (pieceToMove << 3) | Knight; 
        changeSides();
        return; 
    }
    if(flag == promoteB){
        board[start] = 0; 
        board[end] = (pieceToMove << 3) | Bishop; 
        changeSides();
        return; 
    }
    
    board[start] = 0; 
    board[end] = piece;
    changeSides();
}

function genSlidingMoves(start, piece){
    let moves = [];
    let indexE = 8; // starts out with a queen
    let indexS = 0; // starts out with a queen
    indexE = ((piece & 7) == Rook) ? 4: indexE; // rook
    indexS = ((piece & 7) == Bishop) ? 4: indexS;  // bishop
    for(let i = indexS; i < indexE; i ++){
        for(let j = 1; j < distToEdge[start][i]; j++){
            // goes through no friends
            if(board[start + (offsets[i] * j)] >> 3 == pieceToMove){
                break;
            }
            moves.push({start: start, end: start + offsets[i] * j, flags: (quite << 6) + piece, capped: board[start + offsets[i] * j] });
            // can go through one enemy
            if(board[start + (offsets[i] * j)] >> 3 == opponent){
                break;
            }
            // CODE FOR KINGS:
            if( (piece & 7) == King){
                break;
            }
        }
    }
    if( (piece & 7) == King){
        moves = moves.concat(genCastles(start));
    }
    return moves;
}

function genPawnMoves(start){
    let moves = [];
    const isWhite =  pieceToMove == (White >> 3)
    const front = isWhite ? 0 : 2; 
    const left = isWhite ? 5: 7; 
    const right = isWhite ? 4 : 6; 
    if(distToEdge[start][front] > 6 && board[start + offsets[front] * 2] == 0 && board[ start + offsets[front]] == 0){ // if the pawn is not in the back
        moves.push({start: start, end: start + (2 * offsets[front]), flags: (dub << 6) + (pieceToMove << 3 | Pawn), capped: 0});
    }
    if(distToEdge[ start + offsets[left]][front] == 1 && board[start + offsets[left]] >> 3 == opponent) {
        moves.push({start: start, end: start + offsets[left], flags: (promoteB << 6) + (pieceToMove << 3 | Pawn), capped: 0});
        moves.push({start: start, end: start + offsets[left], flags: (promoteK << 6) + (pieceToMove << 3 | Pawn), capped: 0});
        moves.push({start: start, end: start + offsets[left], flags: (promoteR << 6) + (pieceToMove << 3 | Pawn), capped: 0});
        moves.push({start: start, end: start + offsets[left], flags: (promoteQ << 6) + (pieceToMove << 3 | Pawn), capped: 0});
    }else if(board[start + offsets[left]] >> 3 == opponent && distToEdge[start][left] > 1){
        moves.push({start: start, end: start + offsets[left], flags: (quite << 6) + (pieceToMove << 3 | Pawn), capped: board[start + offsets[left]]});
    }
    if(distToEdge[ start + offsets[right]][front] == 1 && board[start + offsets[right]] >> 3 == opponent) {
        moves.push({start: start, end: start + offsets[right], flags: (promoteB << 6) + (pieceToMove << 3 | Pawn), capped: 0});
        moves.push({start: start, end: start + offsets[right], flags: (promoteK << 6) + (pieceToMove << 3 | Pawn), capped: 0});
        moves.push({start: start, end: start + offsets[right], flags: (promoteR << 6) + (pieceToMove << 3 | Pawn), capped: 0});
        moves.push({start: start, end: start + offsets[right], flags: (promoteQ << 6) + (pieceToMove << 3 | Pawn), capped: 0});
    }else if(board[start + offsets[right]] >> 3 == opponent && distToEdge[start][right] > 1){
        moves.push({start: start, end: start + offsets[right], flags: (quite << 6) + (pieceToMove << 3 | Pawn), capped: board[start + offsets[right]]});
    }

    // en passant
    const passant = isWhite ? bPassant : wPassant
    if(passant != -1 && distToEdge[start][front] == 4){
        // check L an R
        if((start + offsets[1]) % 8 == passant && distToEdge[start][1] != 1){
            moves.push({start: start, end: start + offsets[1] + offsets[front], flags: (en << 6) + (pieceToMove << 3 | Pawn), capped: 0});
        }else if((start + offsets[3]) % 8 == passant && distToEdge[start][3] != 1){
            moves.push({start: start, end: start + offsets[3] + offsets[front], flags: (en << 6) + (pieceToMove << 3 | Pawn), capped: 0});
        }

    }

    if(distToEdge[ start + offsets[front]][front] == 1 && board[ start + offsets[front]] == 0) {
        moves.push({start: start, end: start + offsets[front], flags: (promoteB << 6) + (pieceToMove << 3 | Pawn), capped: 0});
        moves.push({start: start, end: start + offsets[front], flags: (promoteK << 6) + (pieceToMove << 3 | Pawn), capped: 0});
        moves.push({start: start, end: start + offsets[front], flags: (promoteR << 6) + (pieceToMove << 3 | Pawn), capped: 0});
        moves.push({start: start, end: start + offsets[front], flags: (promoteQ << 6) + (pieceToMove << 3 | Pawn), capped: 0});
    }
    else if(board[ start + offsets[front]] == 0){
        moves.push({start: start, end: start + offsets[front], flags: (quite << 6) + (pieceToMove << 3 | Pawn), capped: 0});
    }
    return moves;
}

function genKnightMoves(start){
    let moves = [];
    if(distToEdge[start][0] > 2){
        const v = start + (offsets[0] * 2);
        if(distToEdge[v][1] > 1){
            if(board[v + offsets[1]] >> 3 != pieceToMove) moves.push({start: start, end: v + offsets[1], flags: (quite << 6) + (pieceToMove << 3 | Knight), capped: board[v + offsets[1]]})
        }
        if(distToEdge[v][3] > 1){
            if(board[v + offsets[3]] >> 3 != pieceToMove) moves.push({start: start, end: v + offsets[3], flags: (quite << 6) + (pieceToMove << 3 | Knight), capped: board[v + offsets[3]]})
        }
    }
    if(distToEdge[start][1] > 2){
        const v = start + (offsets[1] * 2);
        if(distToEdge[v][0] > 1){
            if(board[v + offsets[0]] >> 3 != pieceToMove) moves.push({start: start, end: v + offsets[0], flags: (quite << 6) + (pieceToMove << 3 | Knight), capped: board[v + offsets[0]]})
        }
        if(distToEdge[v][2] > 1){
            if(board[v + offsets[2]] >> 3 != pieceToMove) moves.push({start: start, end: v + offsets[2], flags: (quite << 6) + (pieceToMove << 3 | Knight), capped: board[v + offsets[2]]})
        }
    }
    if(distToEdge[start][2] > 2){
        const v = start + (offsets[2] * 2);
        if(distToEdge[v][1] > 1){
            if(board[v + offsets[1]] >> 3 != pieceToMove) moves.push({start: start, end: v + offsets[1], flags: (quite << 6) + (pieceToMove << 3 | Knight), capped: board[v + offsets[1]]})
        }
        if(distToEdge[v][3] > 1){
            if(board[v + offsets[3]] >> 3 != pieceToMove) moves.push({start: start, end: v + offsets[3], flags: (quite << 6) + (pieceToMove << 3 | Knight), capped: board[v + offsets[3]]})
        }
    }
    if(distToEdge[start][3] > 2){
        const v = start + (offsets[3] * 2);
        if(distToEdge[v][0] > 1){
            if(board[v + offsets[0]] >> 3 != pieceToMove) moves.push({start: start, end: v + offsets[0], flags: (quite << 6) + (pieceToMove << 3 | Knight), capped: board[v + offsets[0]]})
        }
        if(distToEdge[v][2] > 1){
            if(board[v + offsets[2]] >> 3 != pieceToMove) moves.push({start: start, end: v + offsets[2], flags: (quite << 6) + (pieceToMove << 3 | Knight), capped: board[v + offsets[2]]})
        }
    }
    return moves;
}

function genMoves(){
    let moves = new Array(64);
    for(let i = 0; i < boardSize*boardSize; i++){
        const piece = board[i];
        if(piece >> 3 == pieceToMove && ((piece & 7) == Rook | (piece & 7) == Queen | (piece & 7) == Bishop | (piece & 7) == King)){
            moves[i] = genSlidingMoves(i, piece);
        } else if(piece >> 3 == pieceToMove && (piece & 7) == 6){
            moves[i] = genPawnMoves(i);
        }else if (piece >> 3 == pieceToMove && (piece & 7) == 4){
            moves[i] = genKnightMoves(i);
        } else{
            moves[i] = [];
        }

    }
    return moves;
}

function updateBoard(moves){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard(moves);
}

function  getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect(), // abs. size of element
      scaleX = canvas.width / rect.width,    // relationship bitmap vs. element for x
      scaleY = canvas.height / rect.height;  // relationship bitmap vs. element for y
  
    return {
      x: (evt.clientX - rect.left) * scaleX,   // scale mouse coordinates after they have
      y: (evt.clientY - rect.top) * scaleY     // been adjusted to be relative to element
    }
  }

let pieces = new Image();
pieces.src = "./pieces.png";

pieces.onload = function () {
    ctx.imageSmoothingQuality = "high";
    loadFEN("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8")
    //loadFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
    main();
}
