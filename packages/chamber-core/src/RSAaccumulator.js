/*  This code is written to show how RSAaccumulator runs.
    Some parts are simplified very much. */ 
class BigNumber{    //simplified. be not big yet.
    constructor(value){
        this.value = value;
    }

    powInMod(y,z){  //calculate (value**y) % z for int y, BigNumber z.
        let x = 1;
        var a = this.value;
        while(y > 0){
            if(y%2 == 1){
                x = (x*a) % z.value;
                y--;
            }
            y /= 2;
            a= (a*a) % z.value;
        }
        return new BigNumber(x);
    }

    mult(x){
        return new BigNumber(this.value * x.value);
    }

    mod(x){
        return new BigNumber(this.value % x.value);
    }

    equal(x){
        return this.value == x.value;
    }
}

N=new BigNumber(134);//should be big. And the prime factors of N should be unknown to anyone.

class RSAaccumulator{
    static updateAccumulator(accumulator, value){
        return accumulator.powInMod(value,N);
    }

    static hash(value){//should be hash.
        return 255;
    }

    static getProof(setValues, value, generator, accumulator){
        // calcute (q,r,x). it satisfies q**B * g**(vr)* g**x == A
        let h = generator.powInMod(value,N);
        let B = RSAaccumulator.hash(h+accumulator.value);
        let q = new BigNumber(1);
        let r = 0;
        let x = 1;
        for(let i=0;i<setValues.length;i++){
            let x2 = (x * setValues[i]) % value;
            let temp = Math.floor((x * setValues[i]) / value) + (r * setValues[i]);
            let r2 = temp % B;
            let q2 = q.powInMod(setValues[i],N).mult(h.powInMod(Math.floor(temp/B),N)).mod(N);
            x=x2;
            r=r2;
            q=q2;
        }
        return new RSAaccumulatorProof(value,q,r,x);
    }

    static checkNonInclusionProof(generator, accumulator, proof){
        let h = generator.powInMod(proof.value,N);
        let B = RSAaccumulator.hash(h+accumulator.value);
        if(proof.x <= 0 || proof.value <= proof.x){return false;}
        if(proof.r <= 0 || B <= proof.r){return false;}
        if(proof.q.powInMod(B,N).mult(generator.powInMod(proof.r*proof.value+proof.x,N)).mod(N).equal(accumulator)){
            return true;
        }else{
            return false;
        }
    }

    static checkInclusionProof(generator, accumulator, proof){
        let h = generator.powInMod(proof.value,N);
        let B = RSAaccumulator.hash(h+accumulator.value);
        if(proof.x !== 0){return false;}
        if(proof.r <= 0 || B <= proof.r){return false;}
        if(proof.q.powInMod(B,N).mult(generator.powInMod(proof.r*proof.value+proof.x,N)).mod(N).equal(accumulator)){
            return true;
        }else{
            return false;
        }
    }
}

class RSAaccumulatorProof{
    constructor(value,q,r,x){
        this.value=value;
        this.q=q;
        this.r=r;
        this.x=x;
    }
}
//test
coins=[29,31,37];

generator=new BigNumber(3);
accumulator=generator;
for(i=0;i<coins.length;i++){
accumulator=RSAaccumulator.updateAccumulator(accumulator,coins[i]);
}
console.log(generator);
console.log(accumulator);
proof=RSAaccumulator.getProof(coins,29,generator,accumulator);
console.log(proof);
console.log(RSAaccumulator.checkNonInclusionProof(generator,accumulator,proof));
console.log(RSAaccumulator.checkInclusionProof(generator,accumulator,proof));